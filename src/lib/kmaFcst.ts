// 초단기예보 → 시간별(HourlyItem[]) 

const KMA_FCST_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst'

export type HourlyItem = {
    time: string
    temp: number
    icon: string
}

type FcstItem = {
    category: string
    fcstDate: string // "20260812"
    fcstTime: string  // "2100"
    fcstValue: string
}

/** 초단기예보 base: 매시 30분 발표, 안전하게 하나 이전 슬롯 */
export function getFcstBaseDateTime(now = new Date()) {
    const d = new Date(now)
    const minute = d.getMinutes()

    // 30분 이전이면 한 시간 전 30분, 아니면 이번 시 30분 → 여유 있게 1슬롯 전
    if(minute < 30) {
        d.setHours(d.getHours() - 1)
    }
    d.setMinutes(30, 0, 0)

    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')

    return {
        baseDate: `${yyyy}${mm}${dd}`,
        baseTime: `${hh}30`
    }
}

/**
 * 
 * @param sky SKY 값 (1: 맑음, 3: 구름많음, 4: 흐림)
 * @param pty PTY 값 (0: 없음, 1: 비, 2: 비/눈, 3: 눈, 4: 소나기)
 * @returns 'sunny' | 'cloud' | 'rain' | 'snow'
 */
function mapSkyPty(sky: string, pty: string, hour: number) {
    const isNight = hour >= 19 || hour < 6
    if (pty && pty !== '0') return 'rain' // 강수 가있으면 비
    if (sky === '1') {
        return isNight ? 'moon' : 'sunny' // 맑음
    }
    if (sky === '3' || sky === '4') return 'cloud' // 구름많음, 흐림
    return isNight ? 'moon' : 'sunny'
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
    const limitedTimes = sortedTimes.slice(0, 6) // 최대 6개까지 제한(화면에보여줄갯수)

    const hourlyList: HourlyItem[] = []
    limitedTimes.forEach((key) => {
        const item = byTime[key]
        const hour = Number(item.fcstTime.slice(0, 2))
        hourlyList.push({
            time: formatTimeLabel(item.fcstTime),
            temp: Number(item.temp),
            icon: mapSkyPty(item.sky ?? '1', item.pty ?? '0', hour)
        })
    })
    return hourlyList
    

}