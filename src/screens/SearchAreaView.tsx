// src/screens/SearchAreaView.tsx
import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, Keyboard } from 'react-native'
import { searchPlaceByKeyword, SearchedPlace } from '../lib/kakaoMapSearch'
import { latLonToGrid } from '../lib/kmaGrid'
import Ionicons from '@expo/vector-icons/Ionicons'

// 화면 밖(App.tsx)으로 최종 전달할 선택 결과 형태
export type SelectedArea = {
    nx: number
    ny: number
    name: string
    address: string
}

type SearchAreaViewProps = {
    onSelect: (area: SelectedArea) => void // 지역 선택 완료 시 호출
    onCancel?: () => void                  // 뒤로가기
}

export default function SearchAreaView({ onSelect, onCancel }: SearchAreaViewProps) {
    const [keyword, setKeyword] = useState('')
    const [places, setPlaces] = useState<SearchedPlace[]>([])
    const [isSearching, setIsSearching] = useState(false)


    /**
     * keyword가 바뀔 때마다 실행됨.
     * 하지만 실제 API 호출은 setTimeout으로 300ms 뒤로 미뤄둠.
     * 그 사이에 keyword가 또 바뀌면(사용자가 계속 타이핑 중) cleanup 함수가
     * 먼저 실행되면서 이전 타이머를 취소함 → 결과적으로 "타이핑 멈춘 뒤" 딱 한 번만 호출됨
     */
    useEffect(() => {
        const trimKeyword = keyword.trim()
        if (trimKeyword.length < 2) {
            setPlaces([]) // 한 글자면 검색 의미 없음 → 목록 비움
            return
        }
        setIsSearching(true)
        const timerId = setTimeout(async () => {
            try {
                const result = await searchPlaceByKeyword(trimKeyword)
                console.log("지역 검색 결과: ", result)
                setPlaces(result)
            } catch (error) {
                console.error('지역 검색 실패:', error)
                setPlaces([])
            } finally {
                setIsSearching(false)
            }
        }, 300) // 300ms 안 움직이면 실행
        // cleanup: keyword가 다시 바뀌거나 화면이 사라지면 예약된 타이머를 취소
        return () => clearTimeout(timerId)
    }, [keyword]) // keyword가 바뀔 때마다 이 effect가 다시 실행됨    
    
    // 목록에서 하나 골랐을 때
    const handleSelectPlace = (place: SearchedPlace) => {
        Keyboard.dismiss()
        const { nx, ny } = latLonToGrid(place.lat, place.lng)
        onSelect({ nx, ny, name: place.name, address: place.address })
    }

    return (
        <View style={styles.container}>
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.input}
                    placeholder="지역명 검색 (ex: 상암동)"
                    value={keyword}
                    onChangeText={setKeyword}
                    returnKeyType="search"
                    autoFocus
                />
                <Pressable onPress={onCancel} hitSlop={8} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={26} color="#999999" />
                </Pressable>
            </View>

            <FlatList
                data={places}
                keyExtractor={(item, index) => `${item.name}-${index}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                    <Pressable style={styles.placeItem} onPress={() => handleSelectPlace(item)}>
                        <Text style={styles.placeName}>{item.name}</Text>
                        <Text style={styles.placeAddress}>{item.address}</Text>
                    </Pressable>
                )}
                ListEmptyComponent={
                    !isSearching ? <Text style={styles.emptyText}>검색 결과가 없습니다</Text> : null
                }
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        paddingTop: 60,
        paddingHorizontal: 16,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#cccccc',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
    },
    closeButton: {
        marginLeft: 12,   // input과의 간격
    },
    placeItem: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eeeeee',
    },
    placeName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111111',
    },
    placeAddress: {
        fontSize: 13,
        color: '#6b6b6b',
        marginTop: 2,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#999999',
    },
})