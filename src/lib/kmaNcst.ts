// src/lib/kmaNcst.ts
// 초단기실황 → 현재 날씨(WeatherData 형태)만 가져옴
import { mapNcstPty } from './kmaSkyPty'

const KMA_NCST_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst'

/** 이번 시 정각. 정각 후 10분 미만이면 1시간 전 정각 */
export function getNcstBaseDateTime(now = new Date()) {
    const d = new Date(now)
    if (d.getMinutes() < 10) {
        d.setHours(d.getHours() - 1)
    }
    d.setMinutes(0, 0, 0)

    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')

    return {
        baseDate: `${yyyy}${mm}${dd}`,
        baseTime: `${hh}00`,
    }
}

/** 20260823 + 1400 → 26.08.23 14:00 기준 */
export function formatKmaBaseLabel(baseDate: string, baseTime: string) {
    const yy = baseDate.slice(2, 4)
    const mm = baseDate.slice(4, 6)
    const dd = baseDate.slice(6, 8)
    const hh = baseTime.slice(0, 2)
    const mi = baseTime.slice(2, 4).padEnd(2, '0')
    return `${yy}.${mm}.${dd} ${hh}:${mi} 기준`
}

type NcstItem = {
    category: string
    obsrValue: string
}

export type NcstWeather = {
    location: string
    temperature: number
    summary: string
    icon: string
    high: number
    low: number
    /** 실황 강수코드. 초단기예보 SKY와 합칠 때 사용 */
    pty: string
}

/** 초단기실황 1회 호출 */
export async function fetchUltraSrtNcst (
    nx: number,
    ny: number,
    location: string,
): Promise<NcstWeather> {
    const serviceKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY ?? ''
    if(!serviceKey) {
        throw new Error('EXPO_PUBLIC_KMA_SERVICE_KEY 가 없음')
    }

    const { baseDate, baseTime } = getNcstBaseDateTime()

    // serviceKey는 Encoding 형태로 추가 encode x
    const query = 
        `serviceKey=${serviceKey}`
        + `&pageNo=1&numOfRows=100&dataType=JSON`
        + `&base_date=${baseDate}&base_time=${baseTime}`
        + `&nx=${nx}&ny=${ny}`

    const reqJson = `${KMA_NCST_URL}?${query}`
    // console.log("기상청 요청 NCST URL: ", reqJson)

    const result = await fetch(reqJson)
    const resultJson = await result.json()
    // console.log(resultJson.response.body.items)

    const header = resultJson?.response?.header
    if(header?.resultCode !== '00') {
        throw new Error(header?.resultMsg ?? '기상청 응답 오류')
    }

    const items: NcstItem[] = resultJson?.response?.body?.items?.item ?? []
    const byCategory: Record<string, string> = {}
    items.forEach((item) => {
        byCategory[item.category] = item.obsrValue
    })
    
    const temperature = Number(byCategory.T1H) // 기온
    const pty = byCategory.PTY ?? '0' // 강수형태 (실황에는 SKY 없음)
    const hour = new Date().getHours() // 현재 시간
    // 예보 SKY가 오기 전 임시값. fetchWeather에서 sky로 다시 보정
    const { summary, icon } = mapNcstPty(pty, hour)

    return {
        location: location,
        temperature,
        summary,
        icon,
        // 실황에 최고/최저 없음 -> 임시로 현재기온 표시(나중에 단기예보)
        high: Math.round(temperature),
        low: Math.round(temperature),
        pty,
    }
}