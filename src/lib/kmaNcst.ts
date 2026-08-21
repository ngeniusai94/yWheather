// src/lib/kmaNcst.ts
// 초단기실황 → 현재 날씨(WeatherData 형태)만 가져옴
const KMA_NCST_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst'

/** base_date(YYYYMMDD), base_time(HH00) — 1시간 전 정각 */
export function getNcstBaseDateTime(now = new Date()) {
    const d = new Date(now)
    d.setMinutes(0,0,0) //분(0~59), 초(0~59), 밀리초(0~999)
    d.setHours(d.getHours() - 1) //발표 직후 NO_DATA방지

    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')

    return {
        baseDate: `${yyyy}${mm}${dd}`,
        baseTime: `${hh}00`,
    }
}

/** PTY 코드 → 화면용 요약/아이콘 */
function mapPty(pty: string, hour: number) {
    if(hour >= 19 || hour < 6) {
        return {summary: '밤', icon: 'moon' as const}
    }
    if(pty !== '0') {
        return {summary: '비', icon: 'rain' as const}
    }
    return {summary: '맑음', icon: 'sunny' as const}
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
    const pty = byCategory.PTY ?? '0' // 강수량
    const hour = new Date().getHours() // 현재 시간
    const { summary, icon } = mapPty(pty, hour) // 요약/아이콘

    return {
        location: location,
        temperature,
        summary,
        icon,
        // 실황에 최고/최저 없음 -> 임시로 현재기온 표시(나중에 단기예보)
        high: Math.round(temperature),
        low: Math.round(temperature),
    }
}