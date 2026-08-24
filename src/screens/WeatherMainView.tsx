import { supabase } from "../lib/supabaseClient";
import { StatusBar, ScrollView, StyleSheet, Text, Pressable, View, ActivityIndicator } from "react-native";
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from "react";
import { fetchUltraSrtNcst, formatKmaBaseLabel, getNcstBaseDateTime } from "../lib/kmaNcst";
import { fetchUltraSrtFcst, getFcstBaseDateTime } from "../lib/kmaFcst";
import { getVilageBaseDateTime } from "../lib/kmaDaily";
import { fetchWeekDaily } from "../lib/kmaMid";
import WeatherFxLayer from "../components/WeatherFxLayer";

type WeatherMainViewProps = {
    area: { name: string, nx: number, ny:number, address?: string }
    onSearchPress:() => void;
    onMenuPress: () => void
}

type WeatherTheme = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'night'

// summary → 테마 (비/눈은 비 테마, 눈만 눈 테마)
const getTheme = (summary: string): WeatherTheme => {
    if (summary === '눈') return 'snow'
    if (summary.includes('비') || summary === '소나기') return 'rain'
    if (summary.includes('흐림') || summary.includes('구름')) return 'cloudy'
    if (summary.includes('밤')) return 'night'
    return 'sunny'
}

type ThemeColors = {
    gradient: readonly [string, string]
    card: string
    text: string
    muted: string
}
const themeColors: Record<WeatherTheme, ThemeColors> = {
    sunny:  { gradient: ['#5BB4E0', '#D2F0FA'], card: 'rgba(255,255,255,0.72)', text: '#16324A', muted: '#4A6678' },
    cloudy: { gradient: ['#8A96A3', '#D5DCE2'], card: 'rgba(255,255,255,0.72)', text: '#1C2430', muted: '#5A6570' },
    rain:   { gradient: ['#3A5578', '#7A97B4'], card: 'rgba(255,255,255,0.72)', text: '#ffffff', muted: '#E4EAF0' },
    snow:   { gradient: ['#9EC4E0', '#D8E8F4'], card: 'rgba(255,255,255,0.74)', text: '#1E3A4F', muted: '#5A7386' },
    night:  { gradient: ['#0A1728', '#243B5A'], card: 'rgba(255,255,255,0.72)', text: '#ffffff', muted: '#D0D7E0' },
}

const weatherIconName: Record<string, keyof typeof Ionicons.glyphMap> = {
    sunny: 'sunny',
    cloud: 'cloudy',
    rain: 'rainy',
    snow: 'snow',
    moon: 'moon',
}
type WeatherIconKey = keyof typeof weatherIconName

// 테마(또는 테스트 오버라이드)에 맞춰 히어로 아이콘
const themeHeroIcon: Record<WeatherTheme, WeatherIconKey> = {
    sunny: 'sunny',
    cloudy: 'cloud',
    rain: 'rain',
    snow: 'snow',
    night: 'moon',
}

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
    dateMd : string
    high : number
    low : number
    icon : string
    summary : string
    pop : number
}

// 가짜API가 돌려줄 전체묶음
type CurrentResponse = {
    current: CurrentData
    hourly: HourlyItem[]
    daily: DailyItem[]
}

/** 테마 테스트: 'sunny' | 'cloudy' | 'rain' | 'snow' | 'night' 넣으면 API 무시 */
const DEBUG_THEME: WeatherTheme | null = null
const THEME_CYCLE: WeatherTheme[] = ['sunny', 'cloudy', 'rain', 'snow', 'night']

type BaseInfoTipProps = {
    label: string
    isOpen: boolean
    onPress: () => void
}

function BaseInfoTip({ label, isOpen, onPress }: BaseInfoTipProps) {
    return (
        <View style={styles.infoWrap}>
            <Pressable onPress={onPress} hitSlop={8} style={styles.infoBtn}>
                <Ionicons name="information-circle-outline" size={16} color="#8A929A" />
            </Pressable>
            {isOpen ? (
                <Text style={styles.infoLabel}>{label}</Text>
            ) : null}
        </View>
    )
}

async function fetchWeather(
    nx: number,
    ny: number,
    locationName: string,
    areaText: string,
): Promise<CurrentResponse> {
    const [current, hourly, daily] = await Promise.all([
        fetchUltraSrtNcst(nx, ny, locationName),
        fetchUltraSrtFcst(nx, ny).catch((error) => {
            console.error('시간별 예보 실패:', error)
            return [] as HourlyItem[]
        }),
        fetchWeekDaily(nx, ny, areaText).catch((error) => {
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
    const [themeOverride, setThemeOverride] = useState<WeatherTheme | null>(DEBUG_THEME)
    const [openBaseInfo, setOpenBaseInfo] = useState<'hourly' | 'daily' | null>(null)
    const infoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

                const data = await fetchWeather(
                    area.nx,
                    area.ny,
                    area.name,
                    area.address ?? area.name,
                )
                setCurrent(data.current) // 받은 값으로 state 갱신 → 화면 다시 그림
                setHourly(Array.isArray(data.hourly) ? data.hourly : [])
                setDaily(Array.isArray(data.daily) ? data.daily : [])
            } catch (error) {
                console.error('날씨 로드 실패:', error)
                setErrorMessage('날씨를 불러오지 못했습니다.')
            } finally {
                setIsLoading(false)
            }
        }
        loadWeather()
        return () => {
            if (infoTimerRef.current) {
                clearTimeout(infoTimerRef.current)
            }
        }
    }, [area]) // [] = 마운트 때 한번만

    const clearInfoTimer = () => {
        if (infoTimerRef.current) {
            clearTimeout(infoTimerRef.current)
            infoTimerRef.current = null
        }
    }

    const showBaseInfo = (key: 'hourly' | 'daily') => {
        clearInfoTimer()
        if (openBaseInfo === key) {
            setOpenBaseInfo(null)
            return
        }
        setOpenBaseInfo(key)
        // infoTimerRef.current = setTimeout(() => {
        //     setOpenBaseInfo(null)
        // }, 2500)
    }

    // ----- 로딩 중: 본문 대신 스피너 -----
    // weather가 null인데 본문을 그리면 .location 접근 시 런타임 에러
    if(isLoading || !current) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#6b6b6b" />
                <Text style={styles.txtLoading}>날씨 정보를 불러오는 중...</Text>
            </View>
        )
    }

    if(errorMessage || !current) {
        return (
            <View style={styles.loading}>
                <Text style={styles.txtLoading}>
                    {errorMessage || '날씨를 불러오지 못했습니다.'}
                </Text>
            </View>
        )
    }

    // ----- 데이터 도착 후: 테마 계산 -----
    // 반드시 weather가 있을 때만 여기 도달
    const theme = themeOverride ?? getTheme(current.summary)
    const thmColors = themeColors[theme]

    const cycleTheme = () => {
        const currentIndex = themeOverride
            ? THEME_CYCLE.indexOf(themeOverride)
            : THEME_CYCLE.indexOf(getTheme(current.summary))
        const nextIndex = (currentIndex + 1) % THEME_CYCLE.length
        setThemeOverride(THEME_CYCLE[nextIndex])
    }

    // 어두운 배경 테마면 흰 아이콘
    const isDarkTheme = theme === 'night' || theme === 'rain'

    const ncstBase = getNcstBaseDateTime()
    const fcstBase = getFcstBaseDateTime()
    const vilageBase = getVilageBaseDateTime()
    const ncstBaseLabel = formatKmaBaseLabel(ncstBase.baseDate, ncstBase.baseTime)
    const hourlyBaseLabel = formatKmaBaseLabel(fcstBase.baseDate, fcstBase.baseTime)
    const dailyBaseLabel = formatKmaBaseLabel(vilageBase.baseDate, vilageBase.baseTime)

    const currentHigh = daily[0]?.high ?? current.high
    const currentLow = daily[0]?.low ?? current.low

    const heroIconKey = themeHeroIcon[theme]
    const mainIcon = weatherIconName[heroIconKey]
    const mainIconColor = heroIconKey === 'sunny' ? '#F5C518' : '#ffffff'

    return (
        <>
            <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />
            <LinearGradient
                colors={thmColors.gradient}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <WeatherFxLayer key={theme} theme={theme} />
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                >
                    {/* 메뉴 | 지역(롱프레스=테마 테스트) | 검색 */}
                    <View style={styles.headerRow}>
                        <Pressable onPress={onMenuPress} hitSlop={8} style={styles.headerSide}>
                            <Ionicons name="menu" size={24} color={thmColors.text} />
                        </Pressable>
                        <Pressable
                            onLongPress={cycleTheme}
                            hitSlop={8}
                            style={styles.locationBtn}
                        >
                            <Text
                                style={[styles.location, { color: thmColors.text }]}
                                numberOfLines={1}
                            >
                                {current.location}
                            </Text>
                            <Ionicons name="location-sharp" size={15} color={thmColors.text} />
                        </Pressable>
                        <Pressable onPress={onSearchPress} hitSlop={8} style={styles.headerSide}>
                            <Ionicons name="search" size={24} color={thmColors.text} />
                        </Pressable>
                    </View>

                    {/* 큰 아이콘 | 온도 + 최저·최고 */}
                    <View style={styles.heroRow}>
                        <View style={styles.heroIconCol}>
                            <Text style={[styles.baseLabel, { color: thmColors.muted }]}>
                                {ncstBaseLabel}
                            </Text>
                            <Ionicons name={mainIcon} size={120} color={mainIconColor} />
                        </View>
                        <View style={styles.tempCol}>
                            <Text style={[styles.temperature, { color: thmColors.text }]}>
                                {Math.round(current.temperature)}°
                            </Text>
                            <Text style={[styles.highLow, { color: thmColors.muted }]}>
                                최저 {currentLow}°   최고 {currentHigh}°
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.glassCard, { backgroundColor: thmColors.card }]}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={styles.sectionTitle}>시간별 예보</Text>
                            <BaseInfoTip
                                label={hourlyBaseLabel}
                                isOpen={openBaseInfo === 'hourly'}
                                onPress={() => showBaseInfo('hourly')}
                            />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyRow}>
                            {hourly.map((item) => (
                                <View key={item.time} style={styles.hourlyItem}>
                                    <Text style={styles.hourlyTime}>{item.time}</Text>
                                    <Ionicons
                                        name={weatherIconName[item.icon as WeatherIconKey] ?? 'partly-sunny'}
                                        size={28}
                                        color="#2C3A47"
                                    />
                                    <Text style={styles.hourlyTemp}>{Math.round(item.temp)}°</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={[styles.glassCard, styles.dailyCard, { backgroundColor: thmColors.card }]}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={styles.sectionTitle}>주간 예보</Text>
                            <BaseInfoTip
                                label={dailyBaseLabel}
                                isOpen={openBaseInfo === 'daily'}
                                onPress={() => showBaseInfo('daily')}
                            />
                        </View>
                        <View style={styles.dailyList}>
                            <View style={[styles.dailyRow, styles.dailyHeadRow]}>
                                <View style={styles.dailyDayCol}>
                                    <Text style={styles.dailyHeadText}>날짜</Text>
                                </View>
                                <View style={styles.dailyIconWrap}>
                                    <Text style={styles.dailyHeadText}>날씨</Text>
                                </View>
                                <Text style={[styles.dailyPop, styles.dailyHeadText]}>강수확률</Text>
                                <View style={styles.dailyTemps}>
                                    <Text style={[styles.dailyLow, styles.dailyHeadText]}>최저</Text>
                                    <Text style={[styles.dailyHigh, styles.dailyHeadText]}>최고</Text>
                                </View>
                            </View>
                            {daily.map((item, index) => (
                                <View
                                    key={`${item.day}-${item.dateMd}-${index}`}
                                    style={[
                                        styles.dailyRow,
                                        index === daily.length - 1 && styles.dailyRowLast,
                                    ]}
                                >
                                    <View style={styles.dailyDayCol}>
                                        <Text style={styles.dailyDay}>{item.day}</Text>
                                        <Text style={styles.dailyDate}>{item.dateMd}</Text>
                                    </View>
                                    <View style={styles.dailyIconWrap}>
                                        <Ionicons
                                            name={weatherIconName[item.icon as WeatherIconKey] ?? 'partly-sunny'}
                                            size={22}
                                            color="#2C3A47"
                                        />
                                    </View>
                                    <Text style={styles.dailyPop}>{item.pop}%</Text>
                                    <View style={styles.dailyTemps}>
                                        <Text style={styles.dailyLow}>{item.low}°</Text>
                                        <Text style={styles.dailyHigh}>{item.high}°</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </LinearGradient>
        </>
    )

}

const styles = StyleSheet.create({
    headerRow: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
    },
    headerSide: {
        width: 32,
        alignItems: 'center',
    },
    locationBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 8,
    },
    gradient: {
        flex: 1,
    },
    scroll: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: 22,
        paddingTop: 68,
        paddingBottom: 18,
    },
    location: {
        fontSize: 20,
        fontWeight: '600',
        letterSpacing: 0.2,
        color: '#111111',
        textAlign: 'center',
    },
    heroRow: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
        paddingHorizontal: 8,
    },
    heroIconCol: {
        alignItems: 'center',
    },
    baseLabel: {
        fontSize: 12,
        letterSpacing: 0.2,
        marginBottom: 6,
    },
    tempCol: {
        alignItems: 'flex-end',
    },
    temperature: {
        fontSize: 88,
        fontWeight: '200',
        letterSpacing: -2,
        color: '#111111',
        lineHeight: 94,
    },
    highLow: {
        fontSize: 16,
        letterSpacing: 0.3,
        color: '#6b6b6b',
        marginTop: 2,
    },
    glassCard: {
        alignSelf: 'stretch',
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
        shadowColor: '#1A334C',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
    },
    dailyCard: {
        flex: 1,
        marginBottom: 0,
        paddingBottom: 20,
    },
    dailyList: {
        flex: 1,
        justifyContent: 'space-evenly',
    },
    sectionTitleRow: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2C3A47',
    },
    infoWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    infoBtn: {
        padding: 2,
    },
    infoLabel: {
        marginLeft: 4,
        fontSize: 11,
        color: '#9AA3AB',
        letterSpacing: 0.1,
    },
    hourlyRow: {
        alignSelf: 'stretch',
        flexGrow: 0,
    },
    hourlyItem: {
        width: 58,
        alignItems: 'center',
        marginRight: 10,
    },
    hourlyTime: {
        fontSize: 13,
        color: '#6B7784',
        marginBottom: 8,
    },
    hourlyTemp: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 8,
        color: '#1E2A34',
    },
    dailyRow: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(44,58,71,0.08)',
    },
    dailyHeadRow: {
        paddingVertical: 4,
        paddingBottom: 6,
        borderBottomColor: 'rgba(44,58,71,0.12)',
    },
    dailyHeadText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#9AA3AB',
    },
    dailyDayCol: {
        width: 48,
    },
    dailyDay: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2C3A47',
    },
    dailyDate: {
        fontSize: 11,
        color: '#8A929A',
        marginTop: 1,
    },
    dailyIconWrap: {
        flex: 1,
        alignItems: 'center',
    },
    dailyPop: {
        width: 58,
        fontSize: 13,
        color: '#5B8FBF',
        textAlign: 'center',
        marginRight: 8,
    },
    dailyTemps: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    dailyLow: {
        width: 36,
        fontSize: 16,
        color: '#7A8793',
        textAlign: 'right',
    },
    dailyHigh: {
        width: 36,
        fontSize: 16,
        fontWeight: '600',
        color: '#1E2A34',
        textAlign: 'right',
    },
    dailyRowLast: {
        borderBottomWidth: 0,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E8F4FA',
    },
    txtLoading: {
        marginTop: 12,
        fontSize: 14,
        color: '#3d3d3d',
    },
})