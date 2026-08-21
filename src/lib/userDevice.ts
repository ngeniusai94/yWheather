// Expo Push 토큰 발급 + tb_user_device 저장
// 나중에 FCM 으로 바꿀 때: push_cd = 'fcm', 토큰 발급부만 교체하면 됨
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { supabase } from './supabaseClient'
import { APP_CD_YWEATHER } from './pushSchedule'

export const PUSH_CD_EXPO = 'expo' // 테스트용. 추후 'fcm' 으로 변경 예정

/**
 * 알림 권한 → Expo Push Token 발급
 * - 웹/에뮬레이터는 null (실기기 권장)
 * - projectId 없으면 null (app.json extra.eas.projectId 또는 EXPO_PUBLIC_EAS_PROJECT_ID)
 */
export async function getExpoPushToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
        console.info('푸시: 웹은 토큰 발급 생략')
        return null
    }

    // Android 13+: 채널을 먼저 만들어야 권한 팝업이 뜸
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
        })
    }

    // 시뮬레이터는 푸시 토큰이 안 나오는 경우가 많음
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

    // EAS 프로젝트 ID (Expo Push 에 필수)
    const projectId =
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId

    if (!projectId || String(projectId).trim() === '') {
        console.info(
            '푸시: projectId 없음. app.json extra.eas.projectId 또는 EXPO_PUBLIC_EAS_PROJECT_ID 설정 필요',
        )
        return null
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId: String(projectId),
    })
    return tokenResult.data
}

/**
 * 로그인 성공 후 호출: 토큰 발급 → tb_user_device upsert
 * 실패해도 로그인은 막지 않음 (호출부에서 await 만 하고 무시 가능)
 */
export async function registerUserDevice(userSrno: string): Promise<void> {
    try {
        const pushToken = await getExpoPushToken()
        if (!pushToken) return

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
                    push_cd: PUSH_CD_EXPO,
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
            push_cd: PUSH_CD_EXPO, // 나중에 fcm 으로 변경
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
    } catch (e) {
        console.info('디바이스 등록 예외:', e)
    }
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
