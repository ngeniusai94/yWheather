import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet,
    Keyboard,
    Alert,
    TouchableWithoutFeedback, //빈 곳 터치 시 키보드 닫기
 } from 'react-native'
import { supabase } from '../lib/supabaseClient'

type SignupViewProps = {
  onCancel?: () => void // 취소 시 부모(App)가 화면 전환
  onSignupSuccess?: () => void // 가입 성공 후 로그인 화면으로
}

export default function SignupView({ onCancel, onSignupSuccess }: SignupViewProps) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')

  const handleSignup = async () => {
    Keyboard.dismiss() //버튼 누르자마자 키보드내림
    const trimUserId = userId.trim()
    if(!trimUserId || !password) {
        alert('아이디와 비밀번호를 입력해주세요.')
        return
    }

    const email = `${trimUserId}@yWeather.com`

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    })

    if(error) {
        console.info('회원가입 실패:', error.message)
        alert('회원가입 실패. 다시 시도해주세요.')
        return
    }

    const userUuid = data.user?.id //data.user가 있으면 id, null or undefined이면 에러없이 undefined 반환
    if(!userUuid) {
        console.log('사용자 uuid 없음')
        return
    }

    // 고객번호 채번 (DB: fn_next_user_srno — RLS 우회를 위해 security definer 권장)
    const { data: userSrno, error: srnoError } = await supabase.rpc('fn_next_user_srno')
    if (srnoError || !userSrno) {
        console.info('고객번호 채번 실패:', srnoError?.message ?? '결과 없음')
        alert('회원가입에 실패했습니다. 다른 아이디로 시도해주세요.')
        return
    }
    const nextUserSrno = userSrno as string

    const { error: profileError } = await supabase.from('tb_user').insert({
        user_uuid: userUuid,
        user_srno: nextUserSrno,
        user_id: email,
        nickname: nickname.trim() || '',
    })

    if(profileError) {
        console.info('profile error', profileError.message)
        alert('회원가입 실패. 다시 시도해주세요.')
        return
    }

    console.info('회원가입 성공', data.user?.id, nextUserSrno)

    Alert.alert('회원가입 완료', '로그인 해주세요.', [
        {
            text: '확인',
            onPress: () => onSignupSuccess?.(), // 확인 누르면 로그인 화면
        }
    ])

  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
        <Text style={styles.brand}>yWeather</Text>
        <Text style={styles.subtitle}>회원가입</Text>

        <TextInput style={styles.input}
            placeholder="아이디"
            autoCapitalize="none"
            value={userId}
            onChangeText={setUserId}
        />

        <TextInput style={styles.input}
            placeholder="비밀번호"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
        />

        <TextInput style={styles.input}
            placeholder="닉네임 (선택)"
            value={nickname}
            onChangeText={setNickname}
        />

        <Pressable style={styles.btnSignup} onPress={handleSignup}>
            <Text style={styles.txtSignup}>회원가입</Text>
        </Pressable>

        <Pressable style={styles.btnCancel} onPress={onCancel}>
            <Text style={styles.btnCancelTxt}>취소</Text>
        </Pressable>
        </View>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // 화이트
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  brand: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111111', // 검정
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b6b6b', // 회색
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#111111', // 검정 테두리
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111111',
    marginBottom: 12,
  },
  btnSignup: {
    backgroundColor: '#111111', // 검정 버튼
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  txtSignup: {
    color: '#ffffff', // 흰 글자
    fontSize: 16,
    fontWeight: '600',
  },
  btnCancel: {
    backgroundColor: '#ffffff', // 화이트
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  btnCancelTxt: {
    color: '#111111', // 검정 글자
    fontSize: 16,
    fontWeight: '600',
  },
})