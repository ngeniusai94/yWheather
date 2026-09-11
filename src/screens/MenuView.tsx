// src/screens/MenuView.tsx
// 날씨 메인 왼쪽에서 밀어 들어오는 메뉴 (화면 전환 아님)
import { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, Dimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../lib/AuthContext'

// B안 폭: 화면의 72% (D안 240px보다 넓게)
const MENU_WIDTH = Dimensions.get('window').width * 0.72

type MenuViewProps = {
    visible: boolean
    onClose: () => void
    onPushPress: () => void
    onProfilePress: () => void
    onLogout: () => void
    onLoginPress: () => void // 비로그인: 로그인 화면으로
}

export default function MenuView({
    visible,
    onClose,
    onPushPress,
    onProfilePress,
    onLogout,
    onLoginPress,
}: MenuViewProps) {
    const { signOut, profile } = useAuth() // 세션 + Context 프로필을 함께 비움
    const slideX = useRef(new Animated.Value(-MENU_WIDTH)).current

    // tb_user.nickname → Context.profile.nickname (가입 때 입력한 값)
    const brandLabel = profile?.nickname?.trim()
        ? `${profile.nickname.trim()} 님`
        : "로그인이 필요합니다"

    useEffect(() => {
        Animated.timing(slideX, {
            toValue: visible ? 0 : -MENU_WIDTH,
            duration: 250,
            useNativeDriver: true,
        }).start()
    }, [visible, slideX])

    const handleLogout = async () => {
        await signOut() // persist 세션 삭제 → 다음 실행은 로그인 화면
        onLogout() // 메뉴·푸시 모달 닫기
    }

    return (
        <View style={styles.root} pointerEvents={visible ? 'auto' : 'none'}>
            <Pressable
                style={[styles.dim, { opacity: visible ? 1 : 0 }]}
                onPress={onClose}
            />

            <Animated.View
                style={[styles.panel, { transform: [{ translateX: slideX }] }]}
            >
                <View style={styles.headerRow}>
                    <Text style={styles.brand}>{brandLabel}</Text>
                    <Pressable onPress={onClose} hitSlop={8}>
                        <Ionicons name="close" size={22} color="#111111" />
                    </Pressable>
                </View>

                <View style={styles.list}>
                    <Pressable style={styles.menuRow} onPress={onPushPress}>
                        <View style={styles.menuLeft}>
                            <Ionicons name="notifications-outline" size={18} color="#111111" />
                            <Text style={styles.menuTxt}>날씨 알림</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#bbbbbb" />
                    </Pressable>
                    <Pressable style={styles.menuRow} onPress={onProfilePress}>
                        <View style={styles.menuLeft}>
                            <Ionicons name="person-outline" size={18} color="#111111" />
                            <Text style={styles.menuTxt}>내 정보 관리</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#bbbbbb" />
                    </Pressable>
                </View>

                <View style={styles.footer}>
                    <View style={styles.footerRow}>
                        {profile ? (
                            <Pressable style={styles.logoutRow} onPress={handleLogout} hitSlop={8}>
                                <Ionicons name="log-out-outline" size={16} color="#6b6b6b" />
                                <Text style={styles.logoutTxt}>로그아웃</Text>
                            </Pressable>
                        ) : (
                            <Pressable style={styles.logoutRow} onPress={onLoginPress} hitSlop={8}>
                                <Ionicons name="log-in-outline" size={16} color="#6b6b6b" />
                                <Text style={styles.logoutTxt}>로그인</Text>
                            </Pressable>
                        )}
                        <Text style={styles.versionTxt}>ver 1.0.0</Text>
                    </View>
                </View>
            </Animated.View>
        </View>
    )
}

const styles = StyleSheet.create({
    // 메인 화면 전체를 덮는 투명 레이어 (메뉴+딤)
    root: {
        position: 'absolute', // 부모 기준 좌표로 붙임 (문서 흐름에서 빠짐)
        top: 0,               // 위쪽 끝
        right: 0,             // 오른쪽 끝
        bottom: 0,            // 아래쪽 끝
        left: 0,              // 왼쪽 끝 → 네 방향 0이면 화면 전체
        zIndex: 20,           // 숫자 클수록 위에 그려짐 (날씨 화면보다 앞)
    },
    // 메뉴 오른쪽 어두운 배경 — 탭하면 닫힘
    dim: {
        position: 'absolute',                    // 부모 기준 좌표로 붙임
        top: 0,                                  // 위쪽 끝
        right: 0,                                // 오른쪽 끝
        bottom: 0,                               // 아래쪽 끝
        left: 0,                                 // 왼쪽 끝 → 화면 전체
        backgroundColor: 'rgba(0, 0, 0, 0.35)',  // 검정 35% 투명 — 메인만 살짝 어둡게
    },
    // 왼쪽에서 밀려 나오는 흰 패널
    panel: {
        position: 'absolute',                    // 부모(root) 기준 절대 위치
        left: 0,                                 // 왼쪽 벽에 붙임
        top: 0,                                  // 위쪽 끝까지
        bottom: 0,                               // 아래쪽 끝까지 (세로 전체)
        width: MENU_WIDTH,                       // 패널 가로 폭 (좁은 서랍)
        backgroundColor: '#ffffff',              // 배경 흰색
        paddingTop: 80,                          // 위 안여백 — WeatherMainView content.paddingTop 과 동일 (햄버거 높이)
        paddingHorizontal: 24,                   // 좌우 안여백 — WeatherMainView content 와 동일 (햄버거 가로 위치)
        borderRightWidth: StyleSheet.hairlineWidth, // 오른쪽 구분선 두께 (기기에서 가장 얇은 선)
        borderRightColor: '#dddddd',             // 구분선 색 — 연한 회색
    },
    // 상단: 브랜드(왼쪽) | 닫기 X(오른쪽) — WeatherMainView headerRow 여백과 맞춤
    headerRow: {
        flexDirection: 'row',                    // 자식들을 가로로 나열
        alignItems: 'center',                    // 세로 가운데
        justifyContent: 'space-between',         // 왼쪽 문구 / 오른쪽 X
        marginBottom: 8,                         // WeatherMainView headerRow 와 동일
        paddingBottom: 12,                       // 아래 구분선용 안여백
        borderBottomWidth: StyleSheet.hairlineWidth, // 아래 구분선 두께
        borderBottomColor: '#eeeeee',            // 아래 구분선 색
    },
    // 앱 이름 (상단)
    brand: {
        fontSize: 16,                            // 글자 크기 (한 줄에 들어가게)
        fontWeight: '600',                       // 글자 두께 (600 = SemiBold)
        color: '#111111',                        // 글자색 거의 검정
        flexShrink: 1,                           // 길면 줄어들어 잘리지 않고 줄바꿈 가능
    },
    // 메뉴 항목들을 감싸는 영역
    list: {
        marginTop: 4,                            // 위 바깥 간격 (헤더와 살짝 띄움)
    },
    // 한 줄 메뉴 (아이콘+글자 | 화살표)
    menuRow: {
        flexDirection: 'row',                    // 가로 배치
        alignItems: 'center',                    // 세로 가운데
        justifyContent: 'space-between',         // 왼쪽 묶음 / 오른쪽 화살표
        paddingVertical: 14,                     // 위아래 안여백 (행 높이감)
        borderBottomWidth: StyleSheet.hairlineWidth, // 행 아래 구분선 두께
        borderBottomColor: '#eeeeee',            // 행 아래 구분선 색
    },
    // 행 왼쪽: 아이콘 + 글자
    menuLeft: {
        flexDirection: 'row',                    // 아이콘과 글자를 가로로
        alignItems: 'center',                    // 세로 가운데
        gap: 10,                                 // 아이콘과 글자 사이 간격
    },
    // 메뉴 항목 글자
    menuTxt: {
        fontSize: 15,                            // 글자 크기
        fontWeight: '500',                       // 글자 두께 (500 = Medium)
        color: '#111111',                        // 글자색 거의 검정
    },
    // 로그아웃·버전이 붙는 맨 아래 영역
    footer: {
        marginTop: 'auto',                       // 남는 세로 공간을 위로 밀어 바닥으로 이동
        paddingBottom: 40,                       // 아래 안여백 (홈 인디케이터 여유)
        paddingTop: 16,                          // 위 안여백
        borderTopWidth: StyleSheet.hairlineWidth, // 위 구분선 두께
        borderTopColor: '#eeeeee',               // 위 구분선 색
    },
    // 하단: 왼쪽 로그아웃 | 오른쪽 버전
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    // 로그아웃 한 줄 (아이콘 + 글자)
    logoutRow: {
        flexDirection: 'row',                    // 가로 배치
        alignItems: 'center',                    // 세로 가운데
        gap: 8,                                  // 아이콘과 글자 사이 간격
    },
    // 로그아웃 글자
    logoutTxt: {
        fontSize: 14,                            // 글자 크기 (메뉴보다 한 단계 작게)
        fontWeight: '500',                       // 글자 두께 (500 = Medium)
        color: '#6b6b6b',                        // 글자색 회색 (덜 강조)
    },
    // 버전 — 로그아웃과 같은 톤
    versionTxt: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b6b6b',
    },
})
