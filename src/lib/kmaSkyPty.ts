// 기상청 PTY / SKY 공통 매핑 (한곳만 수정)
// 단기예보 PTY: 0없음 1비 2비/눈 3눈 4소나기
// 초단기 PTY: 0없음 1비 2비/눈 3눈 5빗방울 6빗방울눈날림 7눈날림 (4 없음)

export type WeatherIconKey = 'sunny' | 'cloud' | 'rain' | 'snow' | 'moon'

export type WeatherMapped = {
    summary: string
    icon: WeatherIconKey
}

/** PTY만 보고 강수 여부 판단. 0/없음이면 null */
export function mapPtyCode(pty: string): WeatherMapped | null {
    switch (pty) {
        case '1':
        case '5':
            return { summary: '비', icon: 'rain' }
        case '2':
        case '6':
            return { summary: '비/눈', icon: 'snow' }
        case '3':
        case '7':
            return { summary: '눈', icon: 'snow' }
        case '4':
            return { summary: '소나기', icon: 'rain' }
        default:
            return null
    }
}

/** 시간별/일별: PTY 우선, 없으면 SKY
 * SKY — 1:맑음  2:없음  3:구름많음  4:흐림
 */
export function mapSkyPty(sky: string, pty: string, hour?: number): WeatherMapped {
    const precip = mapPtyCode(pty)
    if (precip) return precip

    if (sky === '3') return { summary: '구름많음', icon: 'cloud' }
    if (sky === '4') return { summary: '흐림', icon: 'cloud' }

    // 강수·흐림이 아닐 때만 시각으로 밤/맑음 (19시~5시)
    if (hour !== undefined) {
        if (hour >= 19) return { summary: '밤', icon: 'moon' } // 19~24시
        if (hour < 6) return { summary: '밤', icon: 'moon' } // 0~5시
    }
    return { summary: '맑음', icon: 'sunny' }
}

/** 현재실황: PTY 우선(밤이어도 비/눈 유지), 없으면 밤/맑음 */
export function mapNcstPty(pty: string, hour: number): WeatherMapped {
    const precip = mapPtyCode(pty)
    if (precip) return precip
    if (hour >= 19) return { summary: '밤', icon: 'moon' }
    if (hour < 6) return { summary: '밤', icon: 'moon' }
    return { summary: '맑음', icon: 'sunny' }
}
