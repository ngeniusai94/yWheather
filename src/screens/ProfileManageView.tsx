// 내 정보 관리 — 날씨 알림과 동일하게 Modal(slide)로 연다
import { useState } from 'react'
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
    Modal,
    TextInput,
    Alert,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../lib/AuthContext'

type ProfileManageViewProps = {
    onClose: () => void
    onWithdrawn: () => void // 탈퇴 후 메뉴·모달 닫기
}

export default function ProfileManageView({ onClose, onWithdrawn }: ProfileManageViewProps) {
    const { profile, updateNickname, withdraw } = useAuth()
    const [isNicknameOpen, setIsNicknameOpen] = useState(false)
    const [nicknameDraft, setNicknameDraft] = useState('')
    const [saving, setSaving] = useState(false)
    const [withdrawing, setWithdrawing] = useState(false)

    const openNickname = () => {
        setNicknameDraft(profile?.nickname ?? '')
        setIsNicknameOpen(true)
    }

    const handleSaveNickname = async () => {
        Keyboard.dismiss()
        const nextNickname = nicknameDraft.trim()
        setSaving(true)
        const failMsg = await updateNickname(nextNickname)
        setSaving(false)
        if (failMsg) {
            Alert.alert('알림', failMsg)
            return
        }
        setIsNicknameOpen(false)
    }

    const runWithdraw = async () => {
        if (withdrawing) return
        setWithdrawing(true)
        const failMsg = await withdraw()
        setWithdrawing(false)
        if (failMsg) {
            Alert.alert('알림', failMsg)
            return
        }
        onWithdrawn()
    }

    const handleWithdrawPress = () => {
        Alert.alert(
            '회원탈퇴',
            '계정과 날씨 알림 설정이 삭제됩니다. 같은 아이디로 다시 가입할 수 있습니다.',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '다음',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            '정말 탈퇴할까요?',
                            '이 작업은 되돌릴 수 없습니다.',
                            [
                                { text: '취소', style: 'cancel' },
                                {
                                    text: '탈퇴',
                                    style: 'destructive',
                                    onPress: () => {
                                        void runWithdraw()
                                    },
                                },
                            ],
                        )
                    },
                },
            ],
        )
    }

    return (
        <View style={styles.root}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>내 정보 관리</Text>
                    <Pressable onPress={onClose} hitSlop={8}>
                        <Ionicons name="close" size={22} color="#111111" />
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    <Pressable style={styles.card} onPress={openNickname}>
                        <Text style={styles.rowTitle}>닉네임 변경</Text>
                        <Ionicons name="chevron-forward" size={16} color="#bbbbbb" />
                    </Pressable>
                </ScrollView>

                <View style={styles.footer}>
                    <Pressable
                        onPress={handleWithdrawPress}
                        disabled={withdrawing}
                        hitSlop={8}
                    >
                        <Text style={styles.withdrawTxt}>회원탈퇴</Text>
                    </Pressable>
                </View>
            </View>

            <Modal
                visible={isNicknameOpen}
                animationType="slide"
                onRequestClose={() => setIsNicknameOpen(false)}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={styles.formRoot}>
                        <View style={styles.header}>
                            <Text style={styles.title}>닉네임 변경</Text>
                            <Pressable onPress={() => setIsNicknameOpen(false)} hitSlop={8}>
                                <Ionicons name="close" size={22} color="#111111" />
                            </Pressable>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="닉네임"
                            value={nicknameDraft}
                            onChangeText={setNicknameDraft}
                            autoCapitalize="none"
                        />

                        <Pressable
                            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                            onPress={handleSaveNickname}
                            disabled={saving}
                        >
                            <Text style={styles.saveTxt}>저장</Text>
                        </Pressable>
                    </View>
                </TouchableWithoutFeedback>
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
        paddingTop: 80,
        paddingHorizontal: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#eeeeee',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111111',
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111111',
    },
    footer: {
        paddingBottom: 40,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#eeeeee',
        alignItems: 'flex-start',
    },
    withdrawTxt: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b6b6b',
    },
    formRoot: {
        flex: 1,
        backgroundColor: '#ffffff',
        paddingTop: 80,
        paddingHorizontal: 24,
    },
    input: {
        borderWidth: 1,
        borderColor: '#111111',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111111',
        marginTop: 16,
        marginBottom: 12,
    },
    saveBtn: {
        borderWidth: 1,
        borderColor: '#111111',
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveBtnDisabled: {
        opacity: 0.5,
    },
    saveTxt: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111111',
    },
})
