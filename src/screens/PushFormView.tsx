// 푸시 등록/수정 — F2 섹션 박스 (값만 비움/채움, 하단 버튼 라벨만 다름)
import { useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import SearchAreaView, { SelectedArea } from './SearchAreaView'
import {
  formatPushDaysLabel,
  formatPushSendTm,
  insertPushSchedule,
  parsePushSendTm,
  PushScheduleRow,
  toPushSendTm,
  updatePushSchedule,
} from '../lib/pushSchedule'
import { useAuth } from '../lib/AuthContext'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const MINUTE_OPTIONS = [0, 10, 20, 30, 40, 50]
const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

type PushFormViewProps = {
  initialRow?: PushScheduleRow | null
  onClose: () => void
  onSaved: () => void
}

export default function PushFormView({ initialRow, onClose, onSaved }: PushFormViewProps) {
  const { profile } = useAuth() // 등록 시 user_srno
  const isEdit = !!initialRow

  const initialTime = parsePushSendTm(initialRow?.push_send_tm)
  const [areaName, setAreaName] = useState(initialRow?.push_payload?.areaName ?? '')
  const [areaAddress, setAreaAddress] = useState(initialRow?.push_payload?.areaAddress ?? '')
  const [nx, setNx] = useState(initialRow?.push_payload?.nx ?? 0)
  const [ny, setNy] = useState(initialRow?.push_payload?.ny ?? 0)
  const [isAm, setIsAm] = useState(initialTime.isAm)
  const [hour12, setHour12] = useState(initialTime.hour12)
  const [minute, setMinute] = useState(initialTime.minute)
  const [pushDays, setPushDays] = useState(initialRow?.push_days ?? '1111111')

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isTimeOpen, setIsTimeOpen] = useState(false)
  const [isDaysOpen, setIsDaysOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const sendTm = useMemo(() => toPushSendTm(isAm, hour12, minute), [isAm, hour12, minute])
  const timeLabel = formatPushSendTm(sendTm)
  const daysLabel = formatPushDaysLabel(pushDays)
  const areaLabel = areaName || '지역을 선택하세요'
  const daysDisplay = pushDays
    .split('')
    .map((bit, i) => (bit === '1' ? DAY_LABELS[i] : null))
    .filter(Boolean)
    .join(' ') || '요일을 선택하세요'

  const handleSelectArea = (area: SelectedArea) => {
    setAreaName(area.name)
    setAreaAddress(area.address)
    setNx(area.nx)
    setNy(area.ny)
    setIsSearchOpen(false)
  }

  const toggleDay = (index: number) => {
    const chars = pushDays.padEnd(7, '0').slice(0, 7).split('')
    chars[index] = chars[index] === '1' ? '0' : '1'
    setPushDays(chars.join(''))
  }

  const handleSave = async () => {
    if (!areaName.trim()) {
      Alert.alert('알림', '위치를 선택해주세요.')
      return
    }
    if (!pushDays.includes('1')) {
      Alert.alert('알림', '요일을 하나 이상 선택해주세요.')
      return
    }

    setSaving(true)
    try {
      const userSrno = profile?.userSrno
      if (!userSrno) {
        Alert.alert('알림', '로그인 정보를 확인할 수 없습니다.')
        return
      }

      const input = {
        areaName,
        areaAddress,
        nx,
        ny,
        pushSendTm: sendTm,
        pushDays,
      }

      if (isEdit && initialRow) {
        await updatePushSchedule(initialRow.push_srno, input)
      } else {
        await insertPushSchedule(userSrno, input)
      }
      onSaved()
    } catch (e) {
      console.info('푸시 저장 실패', e)
      Alert.alert('알림', '저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{isEdit ? '푸시 수정' : '푸시 등록'}</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color="#111111" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* 위치 박스 */}
        <Pressable style={styles.box} onPress={() => setIsSearchOpen(true)}>
          <View style={styles.boxLeft}>
            <Text style={styles.boxLabel}>위치</Text>
            <Text style={[styles.boxValue, !areaName && styles.placeholder]} numberOfLines={1}>
              {areaLabel}
            </Text>
            {!!areaAddress && (
              <Text style={styles.boxSub} numberOfLines={1}>
                {areaAddress}
              </Text>
            )}
          </View>
          <Text style={styles.boxAction}>검색</Text>
        </Pressable>

        {/* 시간 박스 */}
        <Pressable style={styles.box} onPress={() => setIsTimeOpen(true)}>
          <View style={styles.boxLeft}>
            <Text style={styles.boxLabel}>시간</Text>
            <Text style={styles.boxValue}>{timeLabel}</Text>
          </View>
          <Text style={styles.boxAction}>변경</Text>
        </Pressable>

        {/* 요일 박스 */}
        <Pressable style={styles.box} onPress={() => setIsDaysOpen(true)}>
          <View style={styles.boxLeft}>
            <Text style={styles.boxLabel}>요일</Text>
            <Text style={styles.boxValue}>{daysLabel}</Text>
            <Text style={styles.boxSub}>{daysDisplay}</Text>
          </View>
          <Text style={styles.boxAction}>변경</Text>
        </Pressable>
      </ScrollView>

      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#111111" />
        ) : (
          <Text style={styles.saveTxt}>{isEdit ? '수정' : '등록'}</Text>
        )}
      </Pressable>

      {/* 지역 검색 */}
      <Modal visible={isSearchOpen} animationType="slide" onRequestClose={() => setIsSearchOpen(false)}>
        <SearchAreaView
          onSelect={handleSelectArea}
          onCancel={() => setIsSearchOpen(false)}
        />
      </Modal>

      {/* 시간 피커 */}
      <Modal visible={isTimeOpen} transparent animationType="fade" onRequestClose={() => setIsTimeOpen(false)}>
        <Pressable style={styles.sheetDim} onPress={() => setIsTimeOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>시간 선택</Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                {[{ label: '오전', value: true }, { label: '오후', value: false }].map((item) => (
                  <Pressable
                    key={item.label}
                    style={[styles.pickerItem, isAm === item.value && styles.pickerItemOn]}
                    onPress={() => setIsAm(item.value)}
                  >
                    <Text style={[styles.pickerTxt, isAm === item.value && styles.pickerTxtOn]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {HOUR_OPTIONS.map((h) => (
                  <Pressable
                    key={h}
                    style={[styles.pickerItem, hour12 === h && styles.pickerItemOn]}
                    onPress={() => setHour12(h)}
                  >
                    <Text style={[styles.pickerTxt, hour12 === h && styles.pickerTxtOn]}>
                      {h}시
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {MINUTE_OPTIONS.map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.pickerItem, minute === m && styles.pickerItemOn]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[styles.pickerTxt, minute === m && styles.pickerTxtOn]}>
                      {String(m).padStart(2, '0')}분
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Pressable style={styles.sheetDone} onPress={() => setIsTimeOpen(false)}>
              <Text style={styles.sheetDoneTxt}>확인</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 요일 선택 */}
      <Modal visible={isDaysOpen} transparent animationType="fade" onRequestClose={() => setIsDaysOpen(false)}>
        <Pressable style={styles.sheetDim} onPress={() => setIsDaysOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>요일 선택</Text>
            <View style={styles.daysPickRow}>
              {DAY_LABELS.map((label, i) => {
                const on = pushDays[i] === '1'
                return (
                  <Pressable
                    key={label}
                    style={[styles.dayChip, on && styles.dayChipOn]}
                    onPress={() => toggleDay(i)}
                  >
                    <Text style={[styles.dayChipTxt, on && styles.dayChipTxtOn]}>{label}</Text>
                  </Pressable>
                )
              })}
            </View>
            <View style={styles.presetRow}>
              <Pressable style={styles.presetBtn} onPress={() => setPushDays('1111111')}>
                <Text style={styles.presetTxt}>매일</Text>
              </Pressable>
              <Pressable style={styles.presetBtn} onPress={() => setPushDays('1111100')}>
                <Text style={styles.presetTxt}>평일</Text>
              </Pressable>
              <Pressable style={styles.presetBtn} onPress={() => setPushDays('0000011')}>
                <Text style={styles.presetTxt}>주말</Text>
              </Pressable>
            </View>
            <Pressable style={styles.sheetDone} onPress={() => setIsDaysOpen(false)}>
              <Text style={styles.sheetDoneTxt}>확인</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 80, // WeatherMainView content.paddingTop 과 동일
    paddingHorizontal: 24, // WeatherMainView 와 동일
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8, // WeatherMainView headerRow 와 동일
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eeeeee',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  body: {
    paddingBottom: 24,
  },
  box: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  boxLeft: {
    flex: 1,
  },
  boxLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
  },
  boxValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  placeholder: {
    color: '#bbbbbb',
    fontWeight: '500',
  },
  boxSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#888888',
  },
  boxAction: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  saveBtn: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 28,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveTxt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  sheetDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    maxHeight: 220,
  },
  pickerCol: {
    flex: 1,
  },
  pickerScroll: {
    flex: 1,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerItemOn: {
    backgroundColor: '#111111',
  },
  pickerTxt: {
    fontSize: 14,
    color: '#111111',
  },
  pickerTxtOn: {
    color: '#ffffff',
    fontWeight: '600',
  },
  sheetDone: {
    marginTop: 16,
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetDoneTxt: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  daysPickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dddddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  dayChipTxt: {
    fontSize: 13,
    color: '#111111',
  },
  dayChipTxtOn: {
    color: '#ffffff',
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  presetBtn: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  presetTxt: {
    fontSize: 13,
    color: '#111111',
  },
})
