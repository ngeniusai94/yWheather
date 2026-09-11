// =============================================================================
// kmaWeather.ts
// 역할: FCM 푸시에 넣을 "제목/본문" 문자열을 만든다.
// 데이터: 기상청 초단기실황(지금 기온·강수) + 단기예보(오늘 최고/최저·하늘)
// 시각: 서버(UTC)가 아니라 한국시간(KST) 기준으로 발표시각을 고른다.
// =============================================================================

/** 푸시 한 건에 넣을 문구 */
export type PushWeatherText = {
  title: string // 잠금화면 한 줄. 예: "다율동 23° 맑음"
  body: string // 여러 줄. 최고/최저, 어제 비교, 강수확률
}

/** 단기예보 API 한 칸 (카테고리 + 예보일시 + 값) */
type VilageItem = {
  category: string // TMX, TMN, SKY, PTY, POP, TMP 등
  fcstDate: string // 예보 날짜 "20260902"
  fcstTime: string // 예보 시각 "1200"
  fcstValue: string // 문자열로 옴. 숫자는 Number()로 변환
}

/** 날짜 하나분의 단기예보를 우리가 쓰기 쉽게 모은 값 */
type DateRow = {
  tmx?: string // 최고기온 (보통 15시 발표값)
  tmn?: string // 최저기온 (보통 06시 발표값)
  sky?: string // 하늘상태 1맑음 3구름많음 4흐림
  pty?: string // 강수형태 0없음 1비 2비/눈 3눈 4소나기
  popMax?: number // 그 날 강수확률 최대값 (%)
  tmpMin?: number // 시간별 기온(TMP) 중 최저 — TMN이 없을 때 대체
  tmpMax?: number // 시간별 기온(TMP) 중 최고 — TMX가 없을 때 대체
}

// 초단기실황: 지금 관측 (기온 T1H, 강수형태 PTY, 1시간강수 RN1)
const KMA_NCST_URL =
  'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst'
// 단기예보(동네예보): 오늘~며칠 최고/최저, 하늘, 강수확률
const KMA_DAILY_URL =
  'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'
// 단기예보는 하루 8번만 발표된다. 이 시각 이외는 요청하면 빈다.
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]

// 같은 cron 실행 안에서 같은 격자(nx,ny)는 기상청을 한 번만 호출
const weatherCache = new Map<string, PushWeatherText>()

/** 서버가 UTC여도 한국 벽시계 시각으로 Date를 만든다 */
export function koreaNow(): Date {
  // toLocaleString으로 KST 문자열을 만든 뒤 다시 Date로 파싱
  const text = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
  return new Date(text)
}

/**
 * 메인 진입점. nx/ny = 기상청 격자, areaName = 푸시 제목 앞부분
 */
export async function buildWeatherPushText(
  nx: number,
  ny: number,
  areaName: string,
): Promise<PushWeatherText> {
  const cacheKey = `${nx},${ny}` // 같은 지역이면 캐시 재사용
  const cached = weatherCache.get(cacheKey)
  if (cached) return cached // 이미 만든 문구면 API 생략

  // 슈퍼베이스 Edge Function 시크릿. 앱 .env 의 EXPO_PUBLIC_KMA_SERVICE_KEY 와 동일
  const serviceKey = Deno.env.get('KMA_SERVICE_KEY') ?? ''
  if (!serviceKey) {
    throw new Error('KMA_SERVICE_KEY 시크릿이 없습니다.')
  }

  const now = koreaNow()
  // 실황 / 오늘 예보 / 어제 예보를 동시에 호출 (배치가 여러 명이어도 격자당 3번)
  const [ncst, todayRow, yesterdayRow] = await Promise.all([
    fetchNcst(serviceKey, nx, ny, now),
    fetchTodayRow(serviceKey, nx, ny, now),
    fetchYesterdayRow(serviceKey, nx, ny, now),
  ])

  const currentTemp = roundNum(ncst.temperature) // 지금 기온
  // 하늘 요약: 비/눈이 우선, 없으면 밤, 없으면 SKY
  const summary = mapSummary(ncst.pty, todayRow?.sky ?? '1', now.getHours())
  // TMX 없으면 시간별 TMP 최댓값, 그것도 없으면 현재기온
  const high = roundNum(Number(todayRow?.tmx ?? todayRow?.tmpMax ?? currentTemp))
  const low = roundNum(Number(todayRow?.tmn ?? todayRow?.tmpMin ?? currentTemp))
  const pop = roundNum(todayRow?.popMax ?? 0) // 강수확률 %
  const rain1h = parseRain1h(ncst.rn1) // 없으면 null → 본문에 안 넣음

  const title = `${areaName} ${currentTemp}° ${summary}`
  const lines = [`최고/최저 ${high}°/${low}°`]

  // 어제 최고가 있을 때만 "어제보다 n° 낮아요" 줄을 붙인다
  const yHigh = Number(yesterdayRow?.tmx ?? yesterdayRow?.tmpMax ?? NaN)
  if (!Number.isNaN(yHigh)) {
    lines.push(compareWithYesterday(high, roundNum(yHigh)))
  }

  lines.push(`강수확률 ${pop}%`)
  if (rain1h !== null) {
    lines.push(`1시간 강수 ${rain1h}mm`)
  }

  const text = { title, body: lines.join('\n') } // 본문은 줄바꿈으로 합침
  weatherCache.set(cacheKey, text)
  return text
}

/** 오늘 최고 vs 어제 최고. 앱에서 흔히 쓰는 비교 문구 */
function compareWithYesterday(todayHigh: number, yesterdayHigh: number): string {
  const diff = todayHigh - yesterdayHigh
  if (diff === 0) return '어제와 같아요'
  if (diff > 0) return `어제보다 ${diff}° 높아요`
  return `어제보다 ${Math.abs(diff)}° 낮아요` // 음수면 절대값으로 "낮아요"
}

/**
 * 푸시 제목용 짧은 날씨말
 * 단기 PTY: 0없음 1비 2비/눈 3눈 4소나기
 * 초단기 PTY: 5빗방울 6빗방울눈날림 7눈날림 (4 없음)
 */
function mapSummary(pty: string, sky: string, hour: number): string {
  if (pty === '1' || pty === '5') return '비'
  if (pty === '2' || pty === '6') return '비/눈'
  if (pty === '3' || pty === '7') return '눈'
  if (pty === '4') return '소나기'
  if (hour >= 19 || hour < 6) return '밤' // 19시~05시, 구름보다 밤 우선
  if (sky === '3') return '구름많음'
  if (sky === '4') return '흐림'
  return '맑음' // SKY 1 또는 그 외
}

/** 실황 RN1. "강수없음" 이거나 0이면 본문에 안 넣으려고 null */
function parseRain1h(raw: string | undefined): number | null {
  if (!raw || raw === '강수없음') return null
  const n = Number(String(raw).replace(/[^\d.]/g, '')) // "1.5mm" 같은 문자 제거
  if (Number.isNaN(n) || n <= 0) return null
  return n
}

function roundNum(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.round(n)
}

/** Date → 기상청 날짜키 "20260902" */
function toDateKey(d: Date): string {
  return (
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') + // getMonth는 0부터라 +1
    String(d.getDate()).padStart(2, '0')
  )
}

/**
 * 초단기실황 발표 시각
 * 정각 후 10분 안에는 이번 시 자료가 없을 수 있어 1시간 전 정각을 쓴다.
 */
function getNcstBase(now: Date) {
  const d = new Date(now)
  if (d.getMinutes() < 10) d.setHours(d.getHours() - 1)
  d.setMinutes(0, 0, 0) // 분·초 버리고 정각
  return {
    baseDate: toDateKey(d),
    baseTime: `${String(d.getHours()).padStart(2, '0')}00`, // 예: "1400"
  }
}

/**
 * 단기예보 발표 시각
 * 발표 직후 데이터가 비는 경우가 있어 10분 여유를 두고,
 * BASE_HOURS 중 지금보다 작거나 같은 가장 늦은 시각을 고른다.
 * 새벽 02시 전이면 어제 23시 발표를 쓴다.
 */
function getVilageBase(now: Date) {
  const d = new Date(now)
  d.setMinutes(d.getMinutes() - 10)
  let hour = d.getHours()
  let chosen = BASE_HOURS[0]
  let found = false
  for (const h of BASE_HOURS) {
    if (h <= hour) {
      chosen = h
      found = true
    }
  }
  if (!found || hour < 2) {
    d.setDate(d.getDate() - 1) // 날짜를 하루 전으로
    chosen = 23
  }
  return {
    baseDate: toDateKey(d),
    baseTime: `${String(chosen).padStart(2, '0')}00`,
  }
}

/** 초단기실황 1회. 기온·강수형태·1시간강수만 꺼낸다 */
async function fetchNcst(serviceKey: string, nx: number, ny: number, now: Date) {
  const { baseDate, baseTime } = getNcstBase(now)
  // serviceKey는 .env에 이미 인코딩된 값. 여기서 encodeURIComponent 하지 않음
  const url =
    `${KMA_NCST_URL}?serviceKey=${serviceKey}` +
    `&pageNo=1&numOfRows=100&dataType=JSON` +
    `&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
  const json = await (await fetch(url)).json()
  const header = json?.response?.header
  if (header?.resultCode !== '00') {
    throw new Error(header?.resultMsg ?? '초단기실황 오류')
  }
  const items = asArray(json?.response?.body?.items?.item)
  const byCat: Record<string, string> = {}
  for (const item of items) {
    byCat[item.category] = item.obsrValue // T1H, PTY, RN1 등을 맵으로
  }
  return {
    temperature: Number(byCat.T1H),
    pty: byCat.PTY ?? '0', // 없으면 강수 없음
    rn1: byCat.RN1,
  }
}

/** 오늘 날짜 키에 해당하는 단기예보 한 줄 */
async function fetchTodayRow(serviceKey: string, nx: number, ny: number, now: Date) {
  const { baseDate, baseTime } = getVilageBase(now)
  const byDate = await fetchVilageByDate(serviceKey, nx, ny, baseDate, baseTime)
  return byDate[toDateKey(now)] // 오늘이 응답에 없으면 undefined
}

/**
 * 어제 최고기온용 단기예보
 * 어제 새벽 2시 전이면 그전날 23시 발표를 써야 어제 TMX가 있을 수 있다.
 */
async function fetchYesterdayRow(serviceKey: string, nx: number, ny: number, now: Date) {
  const y = new Date(now)
  y.setDate(y.getDate() - 1) // 어제
  const yKey = toDateKey(y)
  // 어제 시각이 02시 전: 그저께 23시, 아니면 어제 02시
  const base = y.getHours() < 2
    ? { d: new Date(y), time: '2300' }
    : { d: y, time: '0200' }
  if (y.getHours() < 2) base.d.setDate(base.d.getDate() - 1)
  const byDate = await fetchVilageByDate(
    serviceKey,
    nx,
    ny,
    toDateKey(base.d),
    base.time,
  )
  return byDate[yKey]
}

/**
 * 단기예보 원본을 날짜별로 묶는다.
 * 한 날짜에 시간대별 행이 여러 개라서, TMX/TMN/SKY/POP/TMP를 DateRow에 누적한다.
 */
async function fetchVilageByDate(
  serviceKey: string,
  nx: number,
  ny: number,
  baseDate: string,
  baseTime: string,
): Promise<Record<string, DateRow>> {
  const url =
    `${KMA_DAILY_URL}?serviceKey=${serviceKey}` +
    `&pageNo=1&numOfRows=1000&dataType=JSON` +
    `&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
  const json = await (await fetch(url)).json()
  const header = json?.response?.header
  if (header?.resultCode !== '00') {
    throw new Error(header?.resultMsg ?? '단기예보 오류')
  }
  const items = asArray(json?.response?.body?.items?.item) as VilageItem[]
  const byDate: Record<string, DateRow> = {}
  for (const item of items) {
    if (!byDate[item.fcstDate]) byDate[item.fcstDate] = {} // 날짜 첫 등장
    const row = byDate[item.fcstDate]
    if (item.category === 'TMX') row.tmx = item.fcstValue
    if (item.category === 'TMN') row.tmn = item.fcstValue
    // SKY는 여러 시각이 있음. 비어 있거나 정오(1200)면 갱신 → 낮 하늘 대표값
    if (item.category === 'SKY' && (!row.sky || item.fcstTime === '1200')) {
      row.sky = item.fcstValue
    }
    // 강수가 있는 시각이 하나라도 있으면 그날은 비/눈으로 본다
    if (item.category === 'PTY' && item.fcstValue !== '0') row.pty = item.fcstValue
    if (item.category === 'POP') {
      const pop = Number(item.fcstValue)
      if (!Number.isNaN(pop)) row.popMax = Math.max(row.popMax ?? 0, pop)
    }
    if (item.category === 'TMP') {
      const temp = Number(item.fcstValue)
      if (!Number.isNaN(temp)) {
        row.tmpMin = Math.min(row.tmpMin ?? temp, temp)
        row.tmpMax = Math.max(row.tmpMax ?? temp, temp)
      }
    }
  }
  return byDate
}

/** 기상청 item이 1건이면 객체, 여러 건이면 배열. 둘 다 배열로 맞춤 */
function asArray<T>(raw: T | T[] | undefined): T[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}
