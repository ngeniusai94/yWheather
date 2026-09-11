// 로그인 상태 + tb_user 프로필을 앱 전역에서 읽기 위한 Context
//
// [두 층]
// 1) Supabase Auth 세션  → AsyncStorage 에 이미 저장됨 (앱 꺼도 유지 = 자동로그인 근거)
// 2) tb_user 프로필      → 메모리(Context) 에만 둠. 알림등록·화면표시용
//
// 앱 켤 때 1)이 있으면 2)를 한 번 조회한다.
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'
import { supabase } from './supabaseClient'
import {
    fetchUserProfileByUuid,
    updateNicknameByUuid,
    type UserProfile,
} from './userProfile'
import {
    disableUserDevices,
    registerUserDevice,
    subscribeFcmTokenRefresh,
} from './userDevice'

type AuthContextValue = {
    isReady: boolean // 세션 확인 끝나기 전 false — 그동안은 스피너
    profile: UserProfile | null // null 이면 비로그인 (로그인 화면)
    signIn: (userId: string, password: string) => Promise<string | null> // 실패 시 안내문구
    signOut: () => Promise<void>
    updateNickname: (nickname: string) => Promise<string | null>
    withdraw: () => Promise<string | null> // 실패 시 안내문구
}

const AuthContext = createContext<AuthContextValue | null>(null)

// 로그인·자동로그인 성공 시 고객정보 로그 (수동/자동 공통)
// function logLoginSuccess(profile: UserProfile) {
//     console.log(
//         `Login Success | userSrno : ${profile.userSrno}, nickname : ${profile.nickname}`,
//     )
// }

type AuthProviderProps = {
    children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [isReady, setIsReady] = useState(false)
    const [profile, setProfile] = useState<UserProfile | null>(null)

    // uuid 로 tb_user 를 읽어 Context 에 넣음. 없거나 use_yn != Y 면 세션도 지움
    const loadProfile = useCallback(async (userUuid: string) => {
        const nextProfile = await fetchUserProfileByUuid(userUuid)
        if (!nextProfile || nextProfile.useYn !== 'Y') {
            await supabase.auth.signOut() // 다음 실행 때 로그인 화면이 원칙이 되도록
            setProfile(null)
            return
        }
        // logLoginSuccess(nextProfile) // 자동로그인 성공
        console.log(
            `Login Success(auto) | userSrno : ${nextProfile.userSrno}, nickname : ${nextProfile.nickname}`,
        )
        setProfile(nextProfile)
        // 로그인 성공 → 알림권한 → FCM 토큰 → tb_user_device (실패해도 로그인 유지)
        void registerUserDevice(nextProfile.userSrno)
    }, [])

    useEffect(() => {
        let alive = true // unmount 후 setState 방지

        // 앱 시작: 예전에 로그인했고 로그아웃 안 했으면 session 이 있음
        supabase.auth.getSession().then(async ({ data }) => {
            if (!alive) return
            const userUuid = data.session?.user?.id
            if (userUuid) {
                await loadProfile(userUuid) // 프로필 채우면 App 이 홈으로
            } else {
                setProfile(null) // 세션 없음 → 로그인 화면이 원칙
            }
            if (alive) setIsReady(true)
        })

        // 로그아웃(다른 탭·만료 포함) 시 메모리 프로필도 비움
        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
            if (!alive) return
            if (event === 'SIGNED_OUT') {
                setProfile(null)
            }
        })

        return () => {
            alive = false
            listener.subscription.unsubscribe()
        }
    }, [loadProfile])

    // 로그인 중이면 FCM 토큰 갱신 구독
    useEffect(() => {
        if (!profile?.userSrno) return
        return subscribeFcmTokenRefresh(profile.userSrno)
    }, [profile?.userSrno])

    // LoginView 에서 호출. 성공이면 profile 이 채워지고 App 이 홈으로 전환
    const signIn = useCallback(async (userId: string, password: string): Promise<string | null> => {
        const email = `${userId.trim()}@yWeather.com` // 회원가입과 동일한 규칙

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error) {
            console.info('로그인 실패:', error.message)
            return '로그인 실패. 다시 시도해주세요.'
        }

        const userUuid = data.user?.id
        if (!userUuid) return '로그인 정보를 가져오지 못했습니다.'

        const nextProfile = await fetchUserProfileByUuid(userUuid)
        if (!nextProfile) return '가입된 정보가 없습니다.'
        if (nextProfile.useYn !== 'Y') {
            await supabase.auth.signOut()
            return '사용할 수 없는 계정입니다.'
        }

        // logLoginSuccess(nextProfile) // 수동 로그인 성공
        console.log(
            `Login Success | userSrno : ${nextProfile.userSrno}, nickname : ${nextProfile.nickname}`,
        )
        setProfile(nextProfile) // userSrno 등을 화면/푸시에서 재사용
        // 로그인 성공 → 알림권한 → FCM 토큰 → tb_user_device
        void registerUserDevice(nextProfile.userSrno)
        return null
    }, [])

    const signOut = useCallback(async () => {
        // 로그아웃 전에 고객번호로 기기 비활성 (profile 비우기 전)
        const userSrno = profile?.userSrno
        if (userSrno) {
            await disableUserDevices(userSrno)
        }
        await supabase.auth.signOut() // persist 된 세션 삭제
        setProfile(null)
    }, [profile?.userSrno])

    const updateNickname = useCallback(async (nickname: string): Promise<string | null> => {
        const userUuid = profile?.userUuid
        if (!userUuid) return '로그인 정보를 확인할 수 없습니다.'

        const failMsg = await updateNicknameByUuid(userUuid, nickname)
        if (failMsg) return failMsg

        setProfile((prev) => (prev ? { ...prev, nickname } : prev))
        return null
    }, [profile?.userUuid])

    // 회원탈퇴: DB 함수가 auth.users 삭제 + tb_user 비활성 (같은 아이디 재가입용)
    const withdraw = useCallback(async (): Promise<string | null> => {
        const { error } = await supabase.rpc('fn_withdraw_account')
        if (error) {
            console.info('회원탈퇴 실패:', error.message)
            return '회원탈퇴에 실패했습니다. 다시 시도해주세요.'
        }

        await supabase.auth.signOut()
        setProfile(null)
        return null
    }, [])

    const value = useMemo(
        () => ({ isReady, profile, signIn, signOut, updateNickname, withdraw }),
        [isReady, profile, signIn, signOut, updateNickname, withdraw],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.')
    }
    return ctx
}
