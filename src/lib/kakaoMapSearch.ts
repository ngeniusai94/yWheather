// src/lib/kakaoMapSearch.ts
// 카카오 로컬 API(키워드로 장소 검색) → 검색 결과 목록

const KAKAO_SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/address.json'
const KAKAO_COORD_URL = 'https://dapi.kakao.com/v2/local/geo/coord2address.json'

// 카카오 응답 원본 형태 (필요한 필드만 정의)
type KakaoDocument = {
    address_name: string     // 지번 주소
    x: string                // 경도(longitude) — 문자열로 옴, 주의!
    y: string                // 위도(latitude) — 문자열로 옴, 주의!
    address?: {
        region_3depth_name: string // 동
        region_2depth_name: string // 구
        region_1depth_name: string // 시/도
    }
}

// 화면에서 쓰기 좋게 가공한 형태
export type SearchedPlace = {
    name: string // 동 이름(ex. 상암동)
    address: string // 구분용 전체 주소(ex. 서울 마포구 상암동)
    lat: number // 위도
    lng: number // 경도
}

function extractDongName(addressName: string): string {
    const words = addressName.trim().split(/\s+/) // 연속 공백 처리
    for (let i = words.length - 1; i >= 0; i--) {
        // 숫자로 끝나는 부분은 제외하고, 한글 "동/읍/면/리/가"로 끝나는 부분만 인정
        if (/^[가-힣]+(동|읍|면|리|가)$/.test(words[i])) {
            return words[i]
        }
    }
    return addressName // 못 찾으면 원본 주소 그대로 (fallback)
}

/**
 * 키워드로 장소 검색
 * @param keyword 사용자가 입력한 검색어 (ex: "상암동")
 */
export async function searchPlaceByKeyword(keyword: string): Promise<SearchedPlace[]> {
    const restApiKey = process.env.EXPO_PUBLIC_KAKAO_REST_KEY ?? ''
    if (!restApiKey) {
        throw new Error('EXPO_PUBLIC_KAKAO_REST_KEY 가 없음')
    }
    
    const trimmedKeyword = keyword.trim()

    // 이미 "동/읍/면/리/가"로 끝나면 그대로 한 번만 검색
    // 그렇지 않으면 "원본 + 동/읍/면 붙인 버전"을 전부 동시에 검색해서 합침
    // → "부산"(시 단위, 원본이 정답)과 "고현"(동/면 단위, 접미사가 정답)을 둘 다 커버
    const candidates = /[동읍면리가]$/.test(trimmedKeyword)
        ? [trimmedKeyword]
        : [trimmedKeyword, `${trimmedKeyword}동`, `${trimmedKeyword}읍`, `${trimmedKeyword}면`]

    const fetchOne = async (searchKeyword: string): Promise<KakaoDocument[]> => {
        const query = `query=${encodeURIComponent(searchKeyword)}`
        const reqJson = `${KAKAO_SEARCH_URL}?${query}`
        const result = await fetch(reqJson, {
            headers: { Authorization: `KakaoAK ${restApiKey}` },
        })
        const resultJson = await result.json()
        if (!result.ok) return [] // 후보 하나가 실패해도 나머지는 계속 진행
        return resultJson?.documents ?? []
    }

    const results = await Promise.all(candidates.map(fetchOne))
    const documents: KakaoDocument[] = results.flat()

    const places = documents.map((doc) => ({
        name: doc.address?.region_3depth_name || extractDongName(doc.address_name),
        address: doc.address_name,
        lat: Number(doc.y),
        lng: Number(doc.x),
    }))

    // 같은 주소가 여러 후보 요청에서 중복으로 나올 수 있으니 address 기준으로 제거
    return Array.from(new Map(places.map((p) => [p.address, p])).values())
}

/** 위경도 → 동 이름/주소 (GPS용) */
export async function fetchAddressByCoord(
    lat: number,
    lng: number,
): Promise<{ name: string; address: string } | null> {
    const restApiKey = process.env.EXPO_PUBLIC_KAKAO_REST_KEY ?? ''
    if (!restApiKey) return null

    const query = `x=${encodeURIComponent(String(lng))}&y=${encodeURIComponent(String(lat))}`
    const result = await fetch(`${KAKAO_COORD_URL}?${query}`, {
        headers: { Authorization: `KakaoAK ${restApiKey}` },
    })
    if (!result.ok) return null

    const resultJson = await result.json()
    const doc = resultJson?.documents?.[0]
    if (!doc) return null

    const addressName = doc.address?.address_name ?? doc.road_address?.address_name
    if (!addressName) return null

    const name = doc.address?.region_3depth_name || extractDongName(addressName)
    return { name, address: addressName }
}