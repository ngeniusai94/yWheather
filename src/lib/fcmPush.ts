// FCM 수신/디버그용 최소 로직 (유지보수 단순화)
import { Platform } from 'react-native'
import {
    getMessaging,
    onMessage,
    onNotificationOpenedApp,
    getInitialNotification,
} from '@react-native-firebase/messaging'

/** 앱 시작 시 1회 호출. 수신 이벤트만 로그 */
export function setupFcmListeners(): () => void {
    if (Platform.OS !== 'ios') {
        return () => {}
    }

    const messaging = getMessaging()

    // 앱이 켜져 있을 때 수신
    const unsubMessage = onMessage(messaging, (message) => {
        console.info('FCM 포그라운드 수신:', message?.notification ?? message?.data)
    })

    // 백그라운드에서 알림 탭
    const unsubOpened = onNotificationOpenedApp(messaging, (message) => {
        console.info('FCM 알림 탭(백그라운드):', message?.notification ?? message?.data)
    })

    // 종료 상태에서 알림 탭으로 실행
    void getInitialNotification(messaging).then((message) => {
        if (message) {
            console.info('FCM 알림 탭(종료):', message?.notification ?? message?.data)
        }
    })

    return () => {
        unsubMessage()
        unsubOpened()
    }
}
