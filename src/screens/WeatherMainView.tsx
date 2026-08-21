import { supabase } from "../lib/supabaseClient";
import { StatusBar, ScrollView, StyleSheet, Text, Pressable, View, ActivityIndicator } from "react-native";
import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useState } from "react";
import { fetchUltraSrtNcst, NcstWeather } from "../lib/kmaNcst";
import { fetchUltraSrtFcst } from "../lib/kmaFcst";
import { fetchVilageFcst } from "../lib/kmaDaily";

type WeatherMainViewProps = {
    area: { name: string, nx: number, ny:number }
    onSearchPress:() => void;
    onMenuPress: () => void
}

type WeatherTheme = 'sunny' | 'cloudy' | 'rain' | 'night'

// summary → 테마 (나중에 API 코드로 교체)
const getTheme = (summary: string): WeatherTheme => {
    if (summary.includes('비')) return 'rain'
    if (summary.includes('흐림') || summary.includes('구름')) return 'cloudy'
    if (summary.includes('밤')) return 'night'
    return 'sunny'
}

type ThemeColors = {
    bg: string
    text: string
    muted: string
    border: string
}
const themeColors: Record<WeatherTheme, ThemeColors> = {
    sunny:  { bg: '#7EC8E3', text: '#111111', muted: '#3d3d3d', border: '#111111' },
    cloudy: { bg: '#A8B0B8', text: '#111111', muted: '#3d3d3d', border: '#111111' },
    rain:   { bg: '#4A6FA5', text: '#ffffff', muted: '#d0d0d0', border: '#ffffff' },
    night:  { bg: '#1A1A2E', text: '#ffffff', muted: '#b0b0b0', border: '#ffffff' },
}

const weatherIconName: Record<string, keyof typeof Ionicons.glyphMap> = {
    sunny: 'sunny',
    cloud: 'cloudy',
    rain: 'rainy',
    moon: 'moon',
}
type WeatherIconKey = keyof typeof weatherIconName

type CurrentData = {
    location: string
    temperature: number
    summary: string
    icon: string
    high: number
    low: number
}

type HourlyItem = {
    time : string
    temp : number
    icon : string
}

type DailyItem = {
    day : string
    high : number
    low : number
    icon : string
}

//가짜API가 돌려줄 전체묶음
type CurrentResponse = {
    current : CurrentData
    hourly : HourlyItem[]
    daily : DailyItem[]
}

async function fetchWeather(nx: number, ny: number, location: string): Promise<CurrentResponse> {
    const [current, hourly, daily] = await Promise.all([
        fetchUltraSrtNcst(nx, ny, location),
        fetchUltraSrtFcst(nx, ny).catch((error) => {
            console.error('시간별 예보 실패:', error)
            return [] as HourlyItem[]
        }),
        fetchVilageFcst(nx, ny).catch((error) => {
            console.error('일별 예보 실패', error)
            return [] as DailyItem[]
        }),
    ])

    return { current, hourly, daily }
}


export default function WeatherMainView({ area, onSearchPress, onMenuPress }: WeatherMainViewProps) {
    const [current, setCurrent] = useState<CurrentData | null>(null)
    const [hourly, setHourly] = useState<HourlyItem[]>([])
    const [daily, setDaily] = useState<DailyItem[]>([])

    // true면 스피너, false면 본문
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    /**
     * area(선택된 지역)가 바뀔 때마다 다시 실행됨.
     * 처음 화면이 뜰 때도 area가 있으니 1회 실행되고,
     * 검색화면에서 다른 지역을 고르면 area가 바뀌면서 자동으로 다시 실행됨.
     */
    useEffect(() => {
        console.log("날씨정보 API 호출: 지역 : ", area)
        const loadWeather = async () => {
            try {
                setIsLoading(true)
                setErrorMessage(null)

                const data = await fetchWeather(area.nx, area.ny, area.name)
                setCurrent(data.current)// 받은 값으로 state 갱신 → 화면 다시 그림
                setHourly(data.hourly)
                setDaily(data.daily)
            } catch (error) {
                console.error('날씨 로드 실패:', error)
                setErrorMessage('날씨를 불러오지 못했습니다.')
            } finally {
                setIsLoading(false)
            }
        }
        loadWeather()
    }, [area]) // [] = 마운트 때 한번만

    // ----- 로딩 중: 본문 대신 스피너 -----
    // weather가 null인데 본문을 그리면 .location 접근 시 런타임 에러
    if(isLoading || !current) {
        return (
            <View style={styles.loading}>
                {/* 돌고 있는 로딩 표시 */}
                <ActivityIndicator size="large" color="#6b6b6b" />
                <Text style={styles.txtLoading}>날씨 정보를 불러오는 중...</Text>
            </View>
        )
    }

    if(errorMessage || !current) {
        return (
            <View style={styles.loading}>
                <Text style={styles.txtLoading}>
                    {errorMessage || '날씨 정보를 불러오지 못했습니다.'}
                </Text>
            </View>
        )
    }

    // ----- 데이터 도착 후: 테마 계산 -----
    // 반드시 weather가 있을 때만 여기 도달
    const theme = getTheme(current.summary)
    const thmColors = themeColors[theme]

    // 어두운 배경 테마면 흰 아이콘
    const isDarkTheme = theme === 'night' || theme === 'rain'

    const currentHigh = daily[0]?.high ?? current.high
    const currentLow = daily[0]?.low ?? current.low

    return (
        <>
            <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />
            <ScrollView style={[styles.scroll, { backgroundColor: thmColors.bg }]}
            contentContainerStyle={styles.content}>
                
                {/* 검색돋보기 */}
                <View style={styles.headerRow}>
                    <Pressable onPress={onMenuPress} hitSlop={8}>
                        <Ionicons name="menu" size={22} color={thmColors.text} />
                    </Pressable>
                    <Text style={[styles.location, { color: thmColors.text }]}>{current.location}</Text>
                    <Pressable onPress={onSearchPress} hitSlop={8}>
                        <Ionicons name="search" size={22} color={thmColors.text} />
                    </Pressable>
                </View>
                
                {/* <Text style={[styles.location, { color: thmColors.text }]}>{current.location}</Text> */}
                <Text style={[styles.temperature, { color: thmColors.text }]}>{current.temperature}°</Text>
                <Text style={[styles.summary, { color: thmColors.text }]}>{current.summary}</Text>
                <Ionicons name={weatherIconName[current.icon as WeatherIconKey] ?? 'partly-sunny'} size={48} color={thmColors.text}/>
                <Text style={[styles.highLow, { color: thmColors.muted }]}>최저 {currentLow}° / 최고 {currentHigh}°</Text>

                {/* 시간별 */}
                <Text style={[styles.sectionTitle, {color: thmColors.text}]}>시간별 예보</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyRow}>
                    {hourly.map((item) => (
                        <View key={item.time} style={styles.hourlyItem}>
                            <Text style={[styles.hourlyTime, { color: thmColors.muted }]}>{item.time}</Text>
                            <Ionicons name={weatherIconName[item.icon as WeatherIconKey] ?? 'partly-sunny'} size={24} color={thmColors.text}/>
                            <Text style={[styles.hourlyTemp, { color: thmColors.text }]}>{item.temp}°</Text>
                        </View>
                    ))}
                </ScrollView>

                {/* 일별 */}
                <Text style={[styles.sectionTitle, { color: thmColors.text }]}>일별 예보</Text>
                {daily.map((item) => (
                    <View key={item.day} style={[styles.dailyRow, { borderBottomColor: thmColors.muted }]}>
                        <Text style={[styles.dailyDay, { color: thmColors.text }]}>{item.day}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name={weatherIconName[item.icon as WeatherIconKey] ?? 'partly-sunny'} size={24} color={thmColors.text}/>
                            <Text style={[styles.dailyTemp, { color: thmColors.muted }]}>{item.low}° / {item.high}°</Text>
                        </View>
                    </View>
                ))}

            </ScrollView>
        </>
    )

}

const styles = StyleSheet.create({
    headerRow: {
        alignSelf: 'stretch',            // 가로 폭 꽉 채움
        flexDirection: 'row',            // 스페이서 - 지역명 - 아이콘 가로 배치
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    headerSpacer: {
        width: 22,                       // 오른쪽 아이콘(size=22)과 같은 폭 → 가운데 정렬 맞춤용
    },    
    scroll: {
        flex: 1,                 // 화면 높이 꽉 채움
        backgroundColor: '#ffffff', // 배경 화이트 (테마는 나중에)
    },
    content: {
        flexGrow: 1,             // 짧은 내용도 화면 높이까지 확장
        paddingHorizontal: 24,   // 좌우 안여백
        paddingTop: 80,          // 위 안여백
        paddingBottom: 40,       // 아래 안여백
        alignItems: 'center',    // 자식 가로 중앙 정렬
    },
    location: {
        fontSize: 28,            // 글자 크기
        fontWeight: '600',       // 글자 두께
        color: '#111111',        // 글자색 검정
        marginBottom: 8,         // 아래 바깥 간격
    },
    temperature: {
        fontSize: 96,            // 큰 온도
        fontWeight: '200',       // 얇은 글씨 (iOS 날씨 느낌)
        color: '#111111',        // 글자색 검정
    },
    summary: {
        fontSize: 20,            // 글자 크기
        color: '#111111',        // 글자색 검정
        marginTop: 4,            // 위 바깥 간격
    },
    highLow: {
        fontSize: 16,            // 글자 크기
        color: '#6b6b6b',        // 글자색 회색
        marginTop: 8,            // 위 바깥 간격
    },
    btnLogout: {
        marginTop: 48,           // 위 바깥 간격
        borderWidth: 1,          // 테두리 두께
        borderColor: '#111111',  // 테두리 색 검정
        borderRadius: 8,         // 모서리 둥글기
        paddingVertical: 12,     // 위아래 안여백
        paddingHorizontal: 20,   // 좌우 안여백
    },
    txtLogout: {
        color: '#111111',        // 글자색 검정
        fontSize: 14,            // 글자 크기
        fontWeight: '600',       // 글자 두께
    },
    sectionTitle: {
        alignSelf: 'flex-start', // 왼쪽 정렬 (부모 center여도)
        fontSize: 16,            // 글자 크기
        fontWeight: '600',       // 글자 두께
        color: '#111111',        // 글자색 검정
        marginTop: 32,           // 위 바깥 간격
        marginBottom: 12,        // 아래 바깥 간격
    },
    hourlyRow: {
        alignSelf: 'stretch',    // 가로 폭을 부모에 맞춤
        flexGrow: 0,   // 가로 스크롤이 세로로 늘어나지 않게 (시간별~일별 사이 공백 방지)
    },
    hourlyItem: {
        width: 64,               // 칸 너비
        alignItems: 'center',    // 칸 안 가로 중앙
        marginRight: 8,          // 오른쪽 간격
    },
    hourlyTime: {
        fontSize: 13,
        color: '#6b6b6b',        // 회색
        marginBottom: 8,
    },
    hourlyTemp: {
        fontSize: 18,
        fontWeight: '500',
        marginTop: 6,  // 아이콘과 온도 사이
    },
    dailyRow: {
        alignSelf: 'stretch',           // 가로 폭을 부모에 맞춤
        flexDirection: 'row',           // 가로로 배치
        justifyContent: 'space-between',// 양끝 정렬
        paddingVertical: 10,            // 위아래 안여백
        borderBottomWidth: 1,           // 아래 구분선 두께
        borderBottomColor: '#eeeeee',   // 구분선 색
    },
    dailyDay: {
        fontSize: 16,
        color: '#111111',
    },
    dailyTemp: {
        fontSize: 16,
        color: '#6b6b6b',
    },
    loading: {
        flex: 1,                    // 화면 전체
        justifyContent: 'center',   // 세로 중앙
        alignItems: 'center',       // 가로 중앙
        backgroundColor: '#111111', // 배경 검정
    },
    txtLoading: {
        marginTop: 12,
        fontSize: 14,
        color: '#ffffff',
    },
})