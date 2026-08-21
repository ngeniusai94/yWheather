// 푸시관리 목록 — L1 세로 카드 + 하단 플러스
// 등록/수정은 Modal(slide)로 열고, 닫으면 목록으로 복귀
import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import PushFormView from './PushFormView'
import {
  formatPushDaysLabel,
  formatPushSendTm,
  listPushSchedules,
  PushScheduleRow,
  updatePushUseYn,
} from '../lib/pushSchedule'
import { useAuth } from '../lib/AuthContext'

type PushManageViewProps = {
  onClose: () => void
}

export default function PushManageView({ onClose }: PushManageViewProps) {
  const { profile } = useAuth() // 자동로그인 때 채워 둔 tb_user
  const [rows, setRows] = useState<PushScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  // 등록/수정 모달
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<PushScheduleRow | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const userSrno = profile?.userSrno
      if (!userSrno) {
        Alert.alert('알림', '로그인이 필요합니다.')
        setRows([])
        return
      }
      const list = await listPushSchedules(userSrno)
      setRows(list)
    } catch (e) {
      console.info('푸시 목록 실패', e)
      Alert.alert('알림', '푸시 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [profile?.userSrno])

  useEffect(() => {
    loadList()
  }, [loadList])

  // 안드로이드 뒤로가기: 폼이 열려 있으면 목록으로만 닫기
  useEffect(() => {
    if (!isFormOpen) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setIsFormOpen(false)
      setEditingRow(null)
      return true
    })
    return () => sub.remove()
  }, [isFormOpen])

  const openCreate = () => {
    setEditingRow(null)
    setIsFormOpen(true)
  }

  const openEdit = (row: PushScheduleRow) => {
    setEditingRow(row)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingRow(null)
  }

  const handleFormSaved = () => {
    closeForm()
    loadList()
  }

  const handleToggle = async (row: PushScheduleRow, next: boolean) => {
    const nextYn = next ? 'Y' : 'N'
    setRows((prev) =>
      prev.map((r) => (r.push_srno === row.push_srno ? { ...r, use_yn: nextYn } : r)),
    )
    try {
      await updatePushUseYn(row.push_srno, nextYn)
    } catch (e) {
      console.info('use_yn 변경 실패', e)
      setRows((prev) =>
        prev.map((r) =>
          r.push_srno === row.push_srno ? { ...r, use_yn: row.use_yn } : r,
        ),
      )
      Alert.alert('알림', '사용 여부 변경에 실패했습니다.')
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>날씨 알림</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#111111" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#111111" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {rows.map((row) => {
              const payload = row.push_payload
              const areaName = payload?.areaName ?? '지역 미설정'
              const areaAddress = payload?.areaAddress ?? ''
              return (
                <View key={row.push_srno} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Pressable style={styles.cardText} onPress={() => openEdit(row)}>
                      <Text style={styles.areaName}>{areaName}</Text>
                      {!!areaAddress && (
                        <Text style={styles.areaAddress} numberOfLines={1}>
                          {areaAddress}
                        </Text>
                      )}
                    </Pressable>
                    <Switch
                      value={row.use_yn === 'Y'}
                      onValueChange={(v) => handleToggle(row, v)}
                      trackColor={{ false: '#dddddd', true: '#111111' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                  <Pressable onPress={() => openEdit(row)}>
                    <Text style={styles.timeTxt}>{formatPushSendTm(row.push_send_tm)}</Text>
                    <View style={styles.daysRow}>
                      {['월', '화', '수', '목', '금', '토', '일'].map((label, i) => {
                        const on = (row.push_days ?? '0000000')[i] === '1'
                        return (
                          <Text key={label} style={[styles.dayTxt, on && styles.dayOn]}>
                            {label}
                          </Text>
                        )
                      })}
                    </View>
                    <Text style={styles.daysHint}>{formatPushDaysLabel(row.push_days)}</Text>
                  </Pressable>
                </View>
              )
            })}

            <Pressable style={styles.plusCard} onPress={openCreate}>
              <Ionicons name="add" size={28} color="#999999" />
            </Pressable>
          </ScrollView>
        )}
      </View>

      {/* 푸시관리와 동일: Modal + slide — 닫으면 목록 유지 */}
      <Modal
        visible={isFormOpen}
        animationType="slide"
        onRequestClose={closeForm}
      >
        <PushFormView
          key={editingRow?.push_srno ?? 'create'}
          initialRow={editingRow}
          onClose={closeForm}
          onSaved={handleFormSaved}
        />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardText: {
    flex: 1,
  },
  areaName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  areaAddress: {
    marginTop: 4,
    fontSize: 12,
    color: '#888888',
  },
  timeTxt: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '500',
    color: '#111111',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dayTxt: {
    fontSize: 12,
    color: '#cccccc',
  },
  dayOn: {
    color: '#111111',
    fontWeight: '600',
  },
  daysHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#aaaaaa',
  },
  plusCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cccccc',
    borderRadius: 10,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
