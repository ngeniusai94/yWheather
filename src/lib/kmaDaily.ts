// src/lib/kmaDaily.ts
// 단기예보 → 일별(DailyItem[])
const KMA_DAILY_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'

const NX = 56
const NY = 126

// 단기예보 발표 시각 (이 값들만 허용) -> 확인필요
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]

export type DailyItem = {
    day: string
    high: number
    low: number
    icon: string
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

function mapSkyPty(sky: string, pty: string) {
    if (pty && pty !== '0') return 'rain'
    if (sky === '1') return 'sunny'
    if (sky === '3' || sky === '4') return 'cloud'
    return 'sunny'
}

/** "20260812" → 오늘/내일/요일 */
function formatDayLabel(fcstDate: string, index: number) {
    if (index === 0) return '오늘'
    if (index === 1) return '내일'
    const y = Number(fcstDate.slice(0, 4))
    const m = Number(fcstDate.slice(4, 6)) - 1 // JS 월은 0부터
    const day = Number(fcstDate.slice(6, 8))
    const week = ['일', '월', '화', '수', '목', '금', '토']
    return week[new Date(y, m, day).getDay()]
}


export async function fetchVilageFcst(): Promise<DailyItem[]> {
    
    const serviceKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY ?? ''
    if (!serviceKey) {
        throw new Error('EXPO_PUBLIC_KMA_SERVICE_KEY 가 없음')
    }

    const { baseDate, baseTime } = getVilageBaseDateTime()

    const query = 
    `serviceKey=${serviceKey}`
    + `&pageNo=1&numOfRows=1000&dataType=JSON`
    + `&base_date=${baseDate}&base_time=${baseTime}`
    + `&nx=${NX}&ny=${NY}`

    const result = await fetch(`${KMA_DAILY_URL}?${query}`)
    const resultJson = await result.json()
    const header = resultJson?.response?.header
    if (header?.resultCode !== '00') {
        throw new Error(header?.resultMsg ?? '단기예보 응답 오류')
    }

    const raw = resultJson?.response?.body?.items?.item ?? [] //[a,b,c] or {a} or []
    const items: VilageItem[] = Array.isArray(raw) ? raw : [raw] //raw는 어찌됬든 []로 들어가게하려고..

    // ----- 날짜별로 TMX(최고) / TMN(최저) / SKY / PTY 모으기 -----
    // 초단기예보(fcst)는 "날짜+시간" 키, 여기(daily)는 "날짜"만 키
    const byDate: Record<string, { tmx?: string; tmn?: string; sky?: string; pty?: string }> = {}

    items.forEach((item) => {
        const key = item.fcstDate // ex) 20260812

        if(!byDate[key]) {
            byDate[key] = {}
        }
        if(item.category === 'TMX') {
            byDate[key].tmx = item.fcstValue
        }
        if(item.category === 'TMN') {
            byDate[key].tmn = item.fcstValue
        }
        if(item.category === 'SKY') {
            byDate[key].sky = item.fcstValue
        }
        if(item.category === 'PTY') {
            byDate[key].pty = item.fcstValue
        }
    })

    // 날짜 문자열 정렬 → 앞에서 4일만
    const sortedDates = Object.keys(byDate).sort()
    const limitedDates = sortedDates.slice(0, 4) // 최대 4일까지 제한(화면에보여줄갯수)

    const dailyList: DailyItem[] = []
    limitedDates.forEach((fcstDate, index) => { // index는 수행시마다 1씩증가 default값은 0
        const row = byDate[fcstDate]

        // 오늘 최저가 이미 지나 데이터가 없을 수 있음 → 없으면 0 대신 최고와 같게 등 처리
        const low = Number(row.tmn ?? row.tmx ?? 0)
        const high = Number(row.tmx ?? row.tmn ?? 0)

        dailyList.push({
            day: formatDayLabel(fcstDate, index),
            high: Math.round(high),
            low: Math.round(low),
            icon: mapSkyPty(row.sky ?? '1', row.pty ?? '0'),
        })
    })

    return dailyList
}