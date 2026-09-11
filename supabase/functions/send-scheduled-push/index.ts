// 스케줄 푸시 발송 — 외부 cron 이 1분마다 호출
// 사용중 알림 + 지금 시각(KST) → 등록 지역 날씨 → FCM
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildWeatherPushText, koreaNow } from './kmaWeather.ts'

const APP_CD = 'yweather'
const PUSH_CD_FCM = 'fcm'

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

type ScheduleRow = {
  push_srno: string
  user_srno: string
  push_payload: {
    areaName?: string
    areaAddress?: string
    nx?: number
    ny?: number
  } | null
}

type DeviceRow = {
  user_srno: string
  device_srno: string
  push_token: string
  platform: string | null
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return json({ ok: false, message: 'POST 또는 GET 만 허용' }, 405)
    }

    const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
    const given = req.headers.get('x-cron-secret') ?? ''
    if (!cronSecret || given !== cronSecret) {
      return json({ ok: false, message: '권한이 없습니다.' }, 401)
    }

    const nowKst = koreaNow()
    const sendTm = toHhmm(nowKst)
    const dayBit = mondayFirstBit(nowKst)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: schedules, error: scheduleError } = await supabase
      .from('tb_push_schedule')
      .select('push_srno, user_srno, push_payload, push_days')
      .eq('app_cd', APP_CD)
      .eq('use_yn', 'Y')
      .eq('push_send_tm', sendTm)

    if (scheduleError) throw scheduleError

    const due = (schedules ?? []).filter((row: { push_days: string | null }) => {
      const bits = (row.push_days ?? '0000000').padEnd(7, '0')
      return bits[dayBit] === '1'
    }) as (ScheduleRow & { push_days: string | null })[]

    if (due.length === 0) {
      return json({ ok: true, sendTm, dayBit, matched: 0, sent: 0 })
    }

    const userSrnos = [...new Set(due.map((s) => s.user_srno))]
    const { data: devices, error: deviceError } = await supabase
      .from('tb_user_device')
      .select('user_srno, device_srno, push_token, platform')
      .eq('app_cd', APP_CD)
      .eq('push_cd', PUSH_CD_FCM)
      .eq('use_yn', 'Y')
      .in('user_srno', userSrnos)

    if (deviceError) throw deviceError

    const deviceList = (devices ?? []) as DeviceRow[]
    const accessToken = await getFirebaseAccessToken()
    const projectId = getServiceAccount().project_id

    let sent = 0
    const errors: string[] = []

    for (const schedule of due) {
      const payload = schedule.push_payload
      const areaName = payload?.areaName ?? '날씨'
      const nx = payload?.nx
      const ny = payload?.ny

      let title = areaName
      let body = '날씨 정보를 가져오지 못했습니다.'
      if (typeof nx === 'number' && typeof ny === 'number') {
        try {
          const text = await buildWeatherPushText(nx, ny, areaName)
          title = text.title
          body = text.body
        } catch (e) {
          errors.push(`${schedule.push_srno} 날씨: ${String(e)}`)
        }
      }

      const targets = deviceList.filter((d) => d.user_srno === schedule.user_srno)
      for (const device of targets) {
        if (!device.push_token) continue
        try {
          await sendFcm(projectId, accessToken, device.push_token, {
            title,
            body,
            schedule,
          })
          sent += 1
        } catch (e) {
          errors.push(`${device.device_srno}: ${String(e)}`)
        }
      }
    }

    return json({
      ok: true,
      sendTm,
      dayBit,
      matched: due.length,
      devices: deviceList.length,
      sent,
      errors,
    })
  } catch (e) {
    return json({ ok: false, message: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function toHhmm(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}${mm}`
}

/** 앱 push_days 와 동일: 0=월 ... 6=일 */
function mondayFirstBit(date: Date): number {
  const jsDay = date.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

function getServiceAccount(): ServiceAccount {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') ?? ''
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON 시크릿이 없습니다.')
  return JSON.parse(raw) as ServiceAccount
}

async function getFirebaseAccessToken(): Promise<string> {
  const sa = getServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    }),
  )
  const unsigned = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${base64Url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`토큰 발급 실패: ${JSON.stringify(data)}`)
  return data.access_token as string
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .trim()
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function base64Url(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let str = ''
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sendFcm(
  projectId: string,
  accessToken: string,
  token: string,
  input: { title: string; body: string; schedule: ScheduleRow },
) {
  const payload = input.schedule.push_payload
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: input.title,
            body: input.body,
            // image: 'https://example.com/push.png', // 알림 큰 이미지 (https 공개 URL)
          },
          data: {
            pushSrno: input.schedule.push_srno,
            userSrno: input.schedule.user_srno,
            areaName: payload?.areaName ?? '',
            areaAddress: payload?.areaAddress ?? '',
            nx: String(payload?.nx ?? ''),
            ny: String(payload?.ny ?? ''),
          },
          android: {
            priority: 'HIGH',
            notification: {
              sound: 'default',
              // image: 'https://example.com/push.png',
              // channel_id: 'weather',
            },
          },
          apns: {
            headers: {
              'apns-priority': '10',
              // 'apns-collapse-id': input.schedule.push_srno,
            },
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                // 'mutable-content': 1, // 이미지 쓸 때
              },
            },
            fcm_options: {
              // image: 'https://example.com/push.png',
            },
          },
        },
      }),
    },
  )

  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
}
