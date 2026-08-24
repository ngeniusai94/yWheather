// src/lib/kmaDaily.ts
// 단기예보 → 일별(DailyItem[])
import { mapSkyPty } from './kmaSkyPty'

const KMA_DAILY_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'

// 단기예보 발표 시각 (이 값들만 허용) -> 확인필요
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]

export type DailyItem = {
    day: string
    dateMd: string
    high: number
    low: number
    icon: string
    summary: string
    pop: number
}

export type DayLabel = {
    day: string
    dateMd: string
}

type VilageItem = {
    category: string
    fcstDate: string // "20260812"
    fcstTime: string
    fcstValue: string
}

/** 지금 시각 기준, 가장 가까운(안전한) 발표 base_date / base_time */
export function getVilageBaseDateTime(now = new Date()) {
    const d = new Date(now)
    //발표 직후 데이터 없을 수 있어 10분 여유
    d.setMinutes(d.getMinutes() - 10)

    let hour = d.getHours()
    let chosen = BASE_HOURS[0]
    let found = false

    for (let i = 0; i < BASE_HOURS.length; i++) {
        if (BASE_HOURS[i] <= hour) {
          chosen = BASE_HOURS[i]
          found = true
        }
    }

    // 아직 새벽 02시 이전이면 어제 23시 발표 사용
    if (!found || (hour < 2)) {
        d.setDate(d.getDate() - 1)
        chosen = 23
    }

    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(chosen).padStart(2, '0')

    return {
        baseDate: `${yyyy}${mm}${dd}`,
        baseTime: `${hh}00`,
    }
}

function toDateKey(d: Date) {
    return String(d.getFullYear())
        + String(d.getMonth() + 1).padStart(2, '0')
        + String(d.getDate()).padStart(2, '0')
        // 여기 부분 어떻게 리턴되는지 ex로 달아줘
}

/** "20260825" → { day: 오늘|내일|월, dateMd: 08.25 } */
export function formatMdWeekLabel(fcstDate: string): DayLabel {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)

    const y = Number(fcstDate.slice(0, 4))
    const m = Number(fcstDate.slice(4, 6))
    const day = Number(fcstDate.slice(6, 8))
    const dateMd = String(m).padStart(2, '0') + '.' + String(day).padStart(2, '0')

    if (fcstDate === toDateKey(now)) {
        return { day: '오늘', dateMd }
    }
    if (fcstDate === toDateKey(tomorrow)) {
        return { day: '내일', dateMd }
    }

    const week = ['일', '월', '화', '수', '목', '금', '토']
    const dow = new Date(y, m - 1, day).getDay()
    return { day: week[dow], dateMd }
}

/** 오늘+offset → { day, dateMd } */
export function formatMdWeekFromOffset(offset: number): DayLabel {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return formatMdWeekLabel(toDateKey(d))
}


type DateRow = {
    tmx?: string
    tmn?: string
    sky?: string
    pty?: string
    popMax?: number
    tmpMin?: number
    tmpMax?: number
}

/** 오늘 TMN(06시)·TMX(15시)가 들어 있는 이른 발표 */
function getEarlyMinMaxBase(now = new Date()) {
    const d = new Date(now)
    if (d.getHours() < 2) {
        d.setDate(d.getDate() - 1)
        return { baseDate: toDateKey(d), baseTime: '2300' }
    }
    return { baseDate: toDateKey(d), baseTime: '0200' }
}

async function fetchVilageItems(
    nx: number,
    ny: number,
    baseDate: string,
    baseTime: string,
): Promise<VilageItem[]> {
    const serviceKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY ?? ''
    if (!serviceKey) {
        throw new Error('EXPO_PUBLIC_KMA_SERVICE_KEY 가 없음')
    }

    const query =
        `serviceKey=${serviceKey}`
        + `&pageNo=1&numOfRows=1000&dataType=JSON`
        + `&base_date=${baseDate}&base_time=${baseTime}`
        + `&nx=${nx}&ny=${ny}`

    const reqJson = `${KMA_DAILY_URL}?${query}`
    console.log("기상청 요청 getVilageFcst URL: ", reqJson)

    const result = await fetch(`${KMA_DAILY_URL}?${query}`)
    const resultJson = await result.json()
    const header = resultJson?.response?.header
    if (header?.resultCode !== '00') {
        throw new Error(header?.resultMsg ?? '단기예보 응답 오류')
    }

    const raw = resultJson?.response?.body?.items?.item ?? []
    return Array.isArray(raw) ? raw : [raw]
}

function groupVilageByDate(items: VilageItem[]) {
    const byDate: Record<string, DateRow> = {}

    items.forEach((item) => {
        const key = item.fcstDate

        if (!byDate[key]) {
            byDate[key] = {}
        }
        if (item.category === 'TMX') {
            byDate[key].tmx = item.fcstValue
        }
        if (item.category === 'TMN') {
            byDate[key].tmn = item.fcstValue
        }
        if (item.category === 'SKY' && (!byDate[key].sky || item.fcstTime === '1200')) {
            byDate[key].sky = item.fcstValue
        }
        if (item.category === 'PTY') {
            const isPrecip = item.fcstValue !== '0'
            const hasPrecip = !!byDate[key].pty && byDate[key].pty !== '0'
            if (isPrecip) {
                byDate[key].pty = item.fcstValue
            } else if (!hasPrecip && (!byDate[key].pty || item.fcstTime === '1200')) {
                byDate[key].pty = item.fcstValue
            }
        }
        if (item.category === 'POP') {
            const pop = Number(item.fcstValue)
            if (!Number.isNaN(pop)) {
                byDate[key].popMax = Math.max(byDate[key].popMax ?? 0, pop)
            }
        }
        if (item.category === 'TMP') {
            const temp = Number(item.fcstValue)
            if (!Number.isNaN(temp)) {
                byDate[key].tmpMin = Math.min(byDate[key].tmpMin ?? temp, temp)
                byDate[key].tmpMax = Math.max(byDate[key].tmpMax ?? temp, temp)
            }
        }
    })

    return byDate
}

export async function fetchVilageFcst(
    nx: number,
    ny: number,
): Promise<DailyItem[]> {
    const { baseDate, baseTime } = getVilageBaseDateTime()
    const items = await fetchVilageItems(nx, ny, baseDate, baseTime)
    const byDate = groupVilageByDate(items)

    // 최신 발표에는 이미 지난 오늘 TMN(06시)/TMX(15시)가 빠짐 → 오늘 02시로 보강
    const todayKey = toDateKey(new Date())
    const todayRow = byDate[todayKey]
    const needMinMax = !todayRow?.tmn || !todayRow?.tmx
    const early = getEarlyMinMaxBase()
    const sameBase = early.baseDate === baseDate && early.baseTime === baseTime

    if (needMinMax && !sameBase) {
        try {
            const earlyItems = await fetchVilageItems(nx, ny, early.baseDate, early.baseTime)
            const earlyByDate = groupVilageByDate(earlyItems)
            const earlyToday = earlyByDate[todayKey]
            if (earlyToday) {
                if (!byDate[todayKey]) {
                    byDate[todayKey] = {}
                }
                if (!byDate[todayKey].tmn && earlyToday.tmn) {
                    byDate[todayKey].tmn = earlyToday.tmn
                }
                if (!byDate[todayKey].tmx && earlyToday.tmx) {
                    byDate[todayKey].tmx = earlyToday.tmx
                }
            }
        } catch (error) {
            console.warn('오늘 최저/최고 보강 실패:', error)
        }
    }

    const sortedDates = Object.keys(byDate).sort()
    const limitedDates = sortedDates.slice(0, 7)

    const dailyList: DailyItem[] = []
    limitedDates.forEach((fcstDate) => {
        const row = byDate[fcstDate]
        const low = Number(row.tmn ?? row.tmpMin ?? 0)
        const high = Number(row.tmx ?? row.tmpMax ?? 0)

        const mapped = mapSkyPty(row.sky ?? '1', row.pty ?? '0')
        const dayLabel = formatMdWeekLabel(fcstDate)
        dailyList.push({
            day: dayLabel.day,
            dateMd: dayLabel.dateMd,
            high: Math.round(high),
            low: Math.round(low),
            icon: mapped.icon,
            summary: mapped.summary,
            pop: Math.round(row.popMax ?? 0),
        })
    })

    return dailyList
}