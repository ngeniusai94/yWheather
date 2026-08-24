// 중기예보 → 단기(약 3일) 이후 일별 보강
import { fetchVilageFcst, formatMdWeekFromOffset, type DailyItem } from './kmaDaily'
import { mapSkyPty, type WeatherMapped } from './kmaSkyPty'

const KMA_MID_LAND_URL = 'https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst'
const KMA_MID_TA_URL = 'https://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa'

/** 주소/지역명 → 중기 육상·기온 구역코드 */
function getMidRegIds(areaText: string) {
    if (areaText.includes('부산')) return { landRegId: '11H20000', taRegId: '11H20201' }
    if (areaText.includes('대구')) return { landRegId: '11H10000', taRegId: '11H10701' }
    if (areaText.includes('인천')) return { landRegId: '11B00000', taRegId: '11B20201' }
    if (areaText.includes('광주')) return { landRegId: '11F20000', taRegId: '11F20501' }
    if (areaText.includes('대전')) return { landRegId: '11C20000', taRegId: '11C20401' }
    if (areaText.includes('울산')) return { landRegId: '11H20000', taRegId: '11H20101' }
    if (areaText.includes('세종')) return { landRegId: '11C20000', taRegId: '11C20404' }
    if (areaText.includes('제주')) return { landRegId: '11G00000', taRegId: '11G00201' }
    if (areaText.includes('강원') || areaText.includes('춘천')) return { landRegId: '11D10000', taRegId: '11D10301' }
    if (areaText.includes('경기') || areaText.includes('수원')) return { landRegId: '11B00000', taRegId: '11B20601' }
    return { landRegId: '11B00000', taRegId: '11B10101' } // 서울 기본
}

/** 06시·18시 발표. 안전하게 직전 슬롯 */
function getMidTmFc(now = new Date()) {
    const d = new Date(now)
    const hour = d.getHours()
    if (hour < 6) {
        d.setDate(d.getDate() - 1)
    }
    const hh = hour < 6 || hour >= 18 ? '18' : '06'
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}${mm}${dd}${hh}00`
}

/** 중기 문구 → 아이콘/요약 */
function mapMidWf(wf: string): WeatherMapped {
    if (wf.includes('눈') && wf.includes('비')) return { summary: '비/눈', icon: 'snow' }
    if (wf.includes('눈')) return { summary: '눈', icon: 'snow' }
    if (wf.includes('소나기')) return { summary: '소나기', icon: 'rain' }
    if (wf.includes('비')) return { summary: '비', icon: 'rain' }
    if (wf.includes('흐림')) return { summary: '흐림', icon: 'cloud' }
    if (wf.includes('구름')) return { summary: '구름많음', icon: 'cloud' }
    if (wf.includes('맑음')) return { summary: '맑음', icon: 'sunny' }
    return mapSkyPty('1', '0')
}


async function fetchMidJson(url: string, query: string) {
    const result = await fetch(`${url}?${query}`)
    const resultJson = await result.json()

    // 공공데이터포털: 해당 서비스를 활용신청하지 않으면 이 형태로 옴
    const authError = resultJson?.OpenAPI_ServiceResponse?.cmmMsgHeader
    if (authError) {
        throw new Error(authError.returnAuthMsg ?? authError.errMsg ?? '중기예보 인증 오류')
    }

    const header = resultJson?.response?.header
    if (header?.resultCode !== '00') {
        throw new Error(header?.resultMsg ?? '중기예보 응답 오류')
    }
    const raw = resultJson?.response?.body?.items?.item ?? {}
    return Array.isArray(raw) ? raw[0] ?? {} : raw
}

/**
 * 단기 다음에 이어서 붙일 일별 (오늘+3 ~ 오늘+6 → 최대 7일)
 * @param alreadyCount 단기에 이미 있는 일수 (보통 3)
 */
export async function fetchMidDaily(
    areaText: string,
    alreadyCount: number,
): Promise<DailyItem[]> {
    const serviceKey =
        process.env.EXPO_PUBLIC_KMA_MID_SERVICE_KEY
        || process.env.EXPO_PUBLIC_KMA_SERVICE_KEY
        || ''
    if (!serviceKey) {
        throw new Error('EXPO_PUBLIC_KMA_SERVICE_KEY 가 없음')
    }

    const { landRegId, taRegId } = getMidRegIds(areaText)
    const tmFc = getMidTmFc()
    const common =
        `serviceKey=${serviceKey}&pageNo=1&numOfRows=10&dataType=JSON&tmFc=${tmFc}`

    const [land, ta] = await Promise.all([
        fetchMidJson(KMA_MID_LAND_URL, `${common}&regId=${landRegId}`),
        fetchMidJson(KMA_MID_TA_URL, `${common}&regId=${taRegId}`),
    ])

    const startN = alreadyCount // 3일이면 n=3 (오늘+3)부터
    const dailyList: DailyItem[] = []

    for (let n = startN; n <= 6; n++) {
        const wf = String(land[`wf${n}Pm`] ?? land[`wf${n}Am`] ?? land[`wf${n}`] ?? '')
        const mapped = mapMidWf(wf)
        const low = Number(ta[`taMin${n}`] ?? 0)
        const high = Number(ta[`taMax${n}`] ?? 0)
        const popAm = Number(land[`rnSt${n}Am`] ?? land[`rnSt${n}`] ?? 0)
        const popPm = Number(land[`rnSt${n}Pm`] ?? 0)
        const pop = Math.max(popAm, popPm)

        const dayLabel = formatMdWeekFromOffset(n)
        dailyList.push({
            day: dayLabel.day,
            dateMd: dayLabel.dateMd,
            high: Math.round(high),
            low: Math.round(low),
            icon: mapped.icon,
            summary: mapped.summary,
            pop: Math.round(Number.isNaN(pop) ? 0 : pop),
        })
    }

    return dailyList
}

/** 단기 + 중기를 합쳐 최대 7일 */
export async function fetchWeekDaily(
    nx: number,
    ny: number,
    areaText: string,
): Promise<DailyItem[]> {
    const shortList = await fetchVilageFcst(nx, ny)
    try {
        const midList = await fetchMidDaily(areaText, shortList.length)
        return shortList.concat(midList).slice(0, 7)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(
            '중기예보 생략:',
            message,
            message.includes('등록')
                ? '(공공데이터포털에서 [기상청_중기예보 조회서비스] 활용신청 후 키를 다시 발급하세요)'
                : '',
        )
        return shortList
    }
}
