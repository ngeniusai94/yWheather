// FCM 토큰 발급 + tb_user_device 저장
// 알림 권한은 expo-notifications, 토큰은 @react-native-firebase/messaging 사용
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import {
    getMessaging,
    getToken,
    getAPNSToken,
    onTokenRefresh,
} from '@react-native-firebase/messaging'
import { supabase } from './supabaseClient'
import { APP_CD_YWEATHER } from './pushSchedule'

export const PUSH_CD_FCM = 'fcm'

/**
 * 알림 권한 → FCM 토큰 발급
 * - 현재 iOS 실기기만 지원 (시뮬레이터/웹/Android는 null)
 */
export async function getFcmPushToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
        console.info('푸시: 웹은 토큰 발급 생략')
        return null
    }

    // 이번 적용 범위는 iOS FCM만
    if (Platform.OS !== 'ios') {
        console.info('푸시: 현재 iOS FCM만 지원')
        return null
    }

    if (!Device.isDevice) {
        console.info('푸시: 실기기가 아니라 토큰 발급 생략')
        return null
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
    }
    if (finalStatus !== 'granted') {
        console.info('푸시: 알림 권한이 거부됨')
        return null
    }

    const messaging = getMessaging()

    // iOS는 APNs 자동 등록됨. registerDeviceForRemoteMessages 는 중복 호출이라 경고가 남
    const apnsToken = await getAPNSToken(messaging)
    console.info('푸시: APNs 토큰:', apnsToken)

    const fcmToken = await getToken(messaging)
    if (!fcmToken) {
        console.info('푸시: FCM 토큰이 비어 있음')
        return null
    }

    console.info('푸시: FCM 토큰 발급 성공:', fcmToken)
    return fcmToken
}

/**
 * 로그인 성공 후 호출: 토큰 발급 → tb_user_device upsert
 * 실패해도 로그인은 막지 않음 (호출부에서 await 만 하고 무시 가능)
 */
export async function registerUserDevice(userSrno: string): Promise<void> {
    try {
        const pushToken = await getFcmPushToken()
        if (!pushToken) return

        await upsertUserDeviceToken(userSrno, pushToken)
    } catch (e) {
        console.info('디바이스 등록 예외:', e)
    }
}

/** FCM 토큰을 tb_user_device에 저장(동일 토큰이면 갱신) */
async function upsertUserDeviceToken(userSrno: string, pushToken: string): Promise<void> {
    const platform =
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web'

    // 같은 유저 + 앱 + 토큰이면 갱신, 없으면 insert
    const { data: existing, error: findError } = await supabase
        .from('tb_user_device')
        .select('device_srno')
        .eq('user_srno', userSrno)
        .eq('app_cd', APP_CD_YWEATHER)
        .eq('push_token', pushToken)
        .maybeSingle()

    if (findError) {
        console.info('디바이스 조회 실패:', findError.message)
        return
    }

    if (existing?.device_srno) {
        const { error: updateError } = await supabase
            .from('tb_user_device')
            .update({
                push_cd: PUSH_CD_FCM,
                platform,
                use_yn: 'Y',
                update_id: 'SYSTEM',
                updated_at: new Date().toISOString(),
            })
            .eq('device_srno', existing.device_srno)

        if (updateError) {
            console.info('디바이스 갱신 실패:', updateError.message)
            return
        }
        console.info('디바이스 토큰 갱신:', existing.device_srno, pushToken)
        return
    }

    const { data: deviceSrno, error: srnoError } = await supabase.rpc('fn_next_device_srno')
    if (srnoError || !deviceSrno) {
        console.info('디바이스 채번 실패:', srnoError?.message)
        return
    }

    const { error: insertError } = await supabase.from('tb_user_device').insert({
        device_srno: deviceSrno,
        user_srno: userSrno,
        app_cd: APP_CD_YWEATHER,
        push_cd: PUSH_CD_FCM,
        push_token: pushToken,
        platform,
        use_yn: 'Y',
        update_id: 'SYSTEM',
    })

    if (insertError) {
        console.info('디바이스 등록 실패:', insertError.message)
        return
    }
    console.info('디바이스 토큰 등록:', deviceSrno, pushToken)
}

/**
 * FCM 토큰 갱신 구독. 로그아웃/언마운트 시 unsubscribe 호출
 */
export function subscribeFcmTokenRefresh(userSrno: string): () => void {
    if (Platform.OS !== 'ios' || !Device.isDevice) {
        return () => {}
    }

    const messaging = getMessaging()
    return onTokenRefresh(messaging, (newToken) => {
        console.info('푸시: FCM 토큰 갱신 감지')
        void upsertUserDeviceToken(userSrno, newToken)
    })
}

/** 로그아웃 시: 해당 유저 기기 use_yn = N (토큰 행은 남김) */
export async function disableUserDevices(userSrno: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('tb_user_device')
            .update({
                use_yn: 'N',
                update_id: 'SYSTEM',
                updated_at: new Date().toISOString(),
            })
            .eq('user_srno', userSrno)
            .eq('app_cd', APP_CD_YWEATHER)
            .eq('use_yn', 'Y')

        if (error) {
            console.info('디바이스 비활성 실패:', error.message)
        }
    } catch (e) {
        console.info('디바이스 비활성 예외:', e)
    }
}
