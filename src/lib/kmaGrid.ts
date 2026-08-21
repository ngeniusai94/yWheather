// src/lib/kmaGrid.ts
// 출처 : https://gist.github.com/fronteer-kr/14d7f779d52a21ac2f16
// 위경도(lat, lon) ↔ 기상청 격자(nx, ny) 변환
// 기상청이 공식 배포하는 변환식(Lambert 도법)을 그대로 옮긴 것 — 상수값은 외울 필요 없음

const RE = 6371.00877     // 지구 반지름(km)
const GRID = 5.0          // 격자 간격(km) — 기상청 격자 한 칸이 5km
const SLAT1 = 30.0        // 투영 위도1(deg)
const SLAT2 = 60.0        // 투영 위도2(deg)
const OLON = 126.0        // 기준점 경도(deg)
const OLAT = 38.0         // 기준점 위도(deg)
const XO = 43             // 기준점 X좌표(GRID 단위)
const YO = 136            // 기준점 Y좌표(GRID 단위)

const DEGRAD = Math.PI / 180.0 // 도(degree) → 라디안(radian) 변환 계수

/**
 * 위도(lat), 경도(lon) → 기상청 격자(nx, ny)
 * @param lat 위도 (ex: 37.5665)
 * @param lon 경도 (ex: 126.9780)
 */
export function latLonToGrid(lat: number, lon: number): { nx: number; ny: number } {
    const re = RE / GRID // 격자 단위로 바꾼 지구 반지름
    const slat1 = SLAT1 * DEGRAD
    const slat2 = SLAT2 * DEGRAD
    const olon = OLON * DEGRAD
    const olat = OLAT * DEGRAD

    // sn, sf, ro는 이 도법에서 쓰는 중간 계산값(공식 고정)
    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)

    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
    sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn

    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
    ro = (re * sf) / Math.pow(ro, sn)

    // 여기서부터 실제 입력값(lat, lon)을 이용한 계산
    let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
    ra = (re * sf) / Math.pow(ra, sn)

    let theta = lon * DEGRAD - olon
    if (theta > Math.PI) theta -= 2.0 * Math.PI
    if (theta < -Math.PI) theta += 2.0 * Math.PI
    theta *= sn

    const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5)
    const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)

    return { nx, ny }
}