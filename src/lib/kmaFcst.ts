// 초단기예보 → 시간별(HourlyItem[])
import { mapSkyPty } from './kmaSkyPty'

/** 초단기는 보통 6시간. 이 숫자만 바꾸면 화면 칸 수가 조절됨 */
export const HOURLY_MAX_COUNT = 6

const KMA_FCST_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst'

export type HourlyItem = {
    time: string
    temp: number
    icon: string
    /** 초단기예보 SKY. 현재날씨 구름상태 보정에 사용 */
    sky?: string
    /** 예보 시각(0~23). 현재 시각과 같은 칸을 찾을 때 사용 */
    fcstHour?: number
}

type FcstItem = {
    category: string
    fcstDate: string // "20260812"
    fcstTime: string  // "2100"
    fcstValue: string
}

/**
 * 초단기예보 base_date / base_time
 *
 * 실황과 다르다. 예보 API는 HH30만 받는다 (1700 넣으면 NO_DATA).
 * - 발표: 매시 30분
 * - 조회 가능: 보통 매시 45분부터
 *
 * 예) 18:10 → 1730 / 18:40 → 1730 / 18:45 → 1830
 */
export function getFcstBaseDateTime(now = new Date()) {
    const d = new Date(now)
    const minute = d.getMinutes()

    // 45분 전에는 이번 시 30분 자료를 아직 못 받음 → 1시간 전 30분
    if (minute < 45) {
        d.setHours(d.getHours() - 1)
    }
    d.setMinutes(30, 0, 0)

    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')

    return {
        baseDate: `${yyyy}${mm}${dd}`,
        baseTime: `${hh}30`,
    }
}

function formatTimeLabel(fcstTime: string) {
    const hour = fcstTime.slice(0, 2) // "2100" → "21시"
    return `${Number(hour)}시`
}

export async function fetchUltraSrtFcst(
    nx: number,
    ny: number,
): Promise<HourlyItem[]> {
    
    const serviceKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY ?? ''
    if(!serviceKey) {
        throw new Error('EXPO_PUBLIC_KMA_SERVICE_KEY 가 없음')
    }

    const {baseDate, baseTime} = getFcstBaseDateTime()

    const query = 
        `serviceKey=${serviceKey}`
        +`&pageNo=1&numOfRows=60&dataType=JSON`
        +`&base_date=${baseDate}&base_time=${baseTime}`
        +`&nx=${nx}&ny=${ny}`

    const result = await fetch(`${KMA_FCST_URL}?${query}`)
    const resultJson = await result.json()
    
    const header = resultJson.response.header
    if(header.resultCode !== '00') {
        throw new Error(header?.resultMsg ?? '초단기예보 응답 오류')
    }

    const items: FcstItem[] = resultJson.response.body.items.item ?? []

    // fcstTime별로 T1H / SKY / PTY 모으기
    const byTime: Record<string, { fcstDate: string; fcstTime: string; temp?: string; sky?: string; pty?: string }> = {}
    items.forEach((item) => {
        const key = `${item.fcstDate}${item.fcstTime}` // 202608121342

        if(!byTime[key]) {
            byTime[key] = { 
                fcstDate: item.fcstDate, // 사용은x 보관만
                fcstTime: item.fcstTime, // 실질적 키
            }
        }
        if(item.category === 'T1H') {
            byTime[key].temp = item.fcstValue // temp: 온도
        }
        if(item.category === 'SKY') {
            byTime[key].sky = item.fcstValue
        }
        if(item.category === 'PTY') {
            byTime[key].pty = item.fcstValue
        }
    })

    const sortedTimes = Object.keys(byTime).sort() // 시간순 정렬
    const limitedTimes = sortedTimes.slice(0, HOURLY_MAX_COUNT)

    const hourlyList: HourlyItem[] = []
    limitedTimes.forEach((key) => {
        const item = byTime[key]
        const hour = Number(item.fcstTime.slice(0, 2))
        hourlyList.push({
            time: formatTimeLabel(item.fcstTime), // 예: 18시
            temp: Number(item.temp),
            icon: mapSkyPty(item.sky ?? '1', item.pty ?? '0', hour).icon,
            sky: item.sky,
            fcstHour: hour,
        })
    })
    return hourlyList
}