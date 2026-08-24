import * as Location from 'expo-location'
import { fetchAddressByCoord } from './kakaoMapSearch'
import { latLonToGrid } from './kmaGrid'

export type WeatherArea = {
    name: string
    nx: number
    ny: number
    address: string
}

/** GPS/권한 실패 시 기본 지역 */
export const DEFAULT_AREA: WeatherArea = {
    name: '상암동',
    nx: 56,
    ny: 126,
    address: '서울 마포구 상암동',
}

/** 현재 위치 → 격자 + 동 이름. 실패하면 null */
export async function fetchGpsArea(): Promise<WeatherArea | null> {
    try {
        const permission = await Location.requestForegroundPermissionsAsync()
        if (permission.status !== 'granted') {
            console.info('위치 권한 거부')
            return null
        }

        const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        })
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const grid = latLonToGrid(lat, lng)

        const addr = await fetchAddressByCoord(lat, lng).catch((error) => {
            console.info('좌표 주소 변환 실패', error)
            return null
        })

        return {
            name: addr?.name ?? '현재 위치',
            nx: grid.nx,
            ny: grid.ny,
            address: addr?.address ?? '현재 위치',
        }
    } catch (error) {
        console.info('GPS 조회 실패', error)
        return null
    }
}
