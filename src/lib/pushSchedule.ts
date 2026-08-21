// 푸시 스케줄 CRUD / 표시용 변환
import { supabase } from './supabaseClient'

export const APP_CD_YWEATHER = 'yweather'

// push_payload 안 yWeather 전용 필드
export type PushAreaPayload = {
  areaName: string
  areaAddress: string
  nx: number
  ny: number
}

export type PushScheduleRow = {
  push_srno: string
  user_srno: string
  app_cd: string
  push_send_tm: string | null // HHMM
  push_days: string | null // 월화수목금토일 7비트
  use_yn: string
  push_payload: PushAreaPayload | null
  update_id: string | null
  created_at: string
  updated_at: string
}

// 고객번호는 AuthContext.profile.userSrno 를 쓴다 (화면에서 재조회하지 않음)

export async function listPushSchedules(userSrno: string): Promise<PushScheduleRow[]> {
  const { data, error } = await supabase
    .from('tb_push_schedule')
    .select('*')
    .eq('user_srno', userSrno)
    .eq('app_cd', APP_CD_YWEATHER)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as PushScheduleRow[]
}

export type SavePushInput = {
  areaName: string
  areaAddress: string
  nx: number
  ny: number
  pushSendTm: string // HHMM
  pushDays: string // 7비트
  useYn?: string
}

export async function insertPushSchedule(
  userSrno: string,
  input: SavePushInput,
): Promise<void> {
  const { data: pushSrno, error: srnoError } = await supabase.rpc('fn_next_push_srno')
  if (srnoError || !pushSrno) {
    throw new Error(srnoError?.message ?? '푸시 번호 채번 실패')
  }

  const { error } = await supabase.from('tb_push_schedule').insert({
    push_srno: pushSrno,
    user_srno: userSrno,
    app_cd: APP_CD_YWEATHER,
    push_send_tm: input.pushSendTm,
    push_days: input.pushDays,
    use_yn: input.useYn ?? 'Y',
    push_payload: {
      areaName: input.areaName,
      areaAddress: input.areaAddress,
      nx: input.nx,
      ny: input.ny,
    },
    update_id: 'SYSTEM',
  })

  if (error) throw error
}

export async function updatePushSchedule(
  pushSrno: string,
  input: SavePushInput,
): Promise<void> {
  const { error } = await supabase
    .from('tb_push_schedule')
    .update({
      push_send_tm: input.pushSendTm,
      push_days: input.pushDays,
      push_payload: {
        areaName: input.areaName,
        areaAddress: input.areaAddress,
        nx: input.nx,
        ny: input.ny,
      },
      update_id: 'SYSTEM',
      updated_at: new Date().toISOString(),
    })
    .eq('push_srno', pushSrno)

  if (error) throw error
}

export async function updatePushUseYn(pushSrno: string, useYn: 'Y' | 'N'): Promise<void> {
  const { error } = await supabase
    .from('tb_push_schedule')
    .update({
      use_yn: useYn,
      update_id: 'SYSTEM',
      updated_at: new Date().toISOString(),
    })
    .eq('push_srno', pushSrno)

  if (error) throw error
}

/** HHMM → 오전/오후 표시 */
export function formatPushSendTm(hhmm: string | null | undefined): string {
  if (!hhmm || hhmm.length !== 4) return '시간 미설정'
  const hour24 = Number(hhmm.slice(0, 2))
  const minute = hhmm.slice(2, 4)
  if (Number.isNaN(hour24)) return '시간 미설정'
  const isAm = hour24 < 12
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12
  return `${isAm ? '오전' : '오후'} ${hour12}:${minute}`
}

/** 오전/오후 + 1~12시 + 분 → HHMM */
export function toPushSendTm(isAm: boolean, hour12: number, minute: number): string {
  let hour24 = hour12 % 12
  if (!isAm) hour24 += 12
  return `${String(hour24).padStart(2, '0')}${String(minute).padStart(2, '0')}`
}

/** HHMM → 피커용 분해 */
export function parsePushSendTm(hhmm: string | null | undefined): {
  isAm: boolean
  hour12: number
  minute: number
} {
  if (!hhmm || hhmm.length !== 4) {
    return { isAm: true, hour12: 7, minute: 0 }
  }
  const hour24 = Number(hhmm.slice(0, 2))
  const minute = Number(hhmm.slice(2, 4))
  const isAm = hour24 < 12
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12
  return { isAm, hour12, minute: Number.isNaN(minute) ? 0 : minute }
}

export function formatPushDaysLabel(pushDays: string | null | undefined): string {
  if (!pushDays || pushDays.length !== 7) return '요일 미설정'
  if (pushDays === '1111111') return '매일'
  if (pushDays === '1111100') return '평일'
  if (pushDays === '0000011') return '주말'
  const labels = ['월', '화', '수', '목', '금', '토', '일']
  const picked = labels.filter((_, i) => pushDays[i] === '1')
  return picked.length === 0 ? '요일 없음' : picked.join(' ')
}
