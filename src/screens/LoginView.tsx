import { View, Text, StyleSheet, Pressable, TextInput,
    Keyboard,
    Alert,
    TouchableWithoutFeedback, //빈 곳 터치 시 키보드 닫기
} from 'react-native'
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type LoginViewProps = {
    onGoSignup?: () => void
    onLoginSuccess?: () => void
}

export default function LoginView({onGoSignup, onLoginSuccess}: LoginViewProps) {
    const [userId, setUserId] = useState('')
    const [password, setPassword] = useState('')
    
    const handleLogin = async () => {
        Keyboard.dismiss()
        const trimUserId = userId.trim()
        if(!trimUserId || !password) {
            alert('아이디와 비밀번호를 입력해주세요.')
            return
        }
        const email = `${trimUserId}@yWeather.com`

        // 1) Auth 로그인 API
        const { data, error } = await supabase.auth.signInWithPassword({
            email, password,
        })

        if(error) {
            console.info('로그인 실패:', error.message)
            alert('로그인 실패. 다시 시도해주세요.')
            return
        }

        // 2) tb_user 확인 (user_uuid = auth 유저 id)
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if(userError || !userData.user) {
          alert('로그인 정보를 가져오지 못했습니다.');
          return;
        }

        const { data: profile, error: profileError } = await supabase
            .from('tb_user')
            .select('*')
            .eq('user_uuid', userData.user.id)
            .maybeSingle()

        if(profileError) {
          console.info('profile error', profileError.message)
          alert('프로필 정보를 가져오지 못했습니다.');
          return;
        }
        
        if (!profile) {
          alert('가입된 정보가 없습니다.')
          return
        }

        // 3) App에 알려서 home으로 전환
        console.info('로그인 성공', profile.user_id, profile.nickname)
        onLoginSuccess?.()
    }



    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
            <Text style={styles.brand}>yWeather</Text>

            <TextInput
                style={styles.input}
                placeholder="아이디"
                autoCapitalize="none"
                value={userId}
                onChangeText={setUserId}
            />
            <TextInput
                style={styles.input}
                placeholder="비밀번호"
                secureTextEntry={true}
                value={password}
                onChangeText={setPassword}
            />

            <Pressable style={styles.btnLogin} onPress={handleLogin}>
                <Text style={styles.loginTxt}>로그인</Text>
            </Pressable>
            <Pressable style={styles.btnSignup} onPress={onGoSignup}>
                <Text style={styles.signupTxt}>회원가입</Text>
            </Pressable>
            </View>
        </TouchableWithoutFeedback>
      )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        paddingHorizontal: 24,
        justifyContent: 'center',
      },
      brand: {
        fontSize: 36,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 8,
      },
      input: {
        borderWidth: 1,
        borderColor: '#111111',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111111',
        marginBottom: 12
      },
      btnLogin: {
        backgroundColor: '#111111',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8
      },
      loginTxt: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
      },
      btnSignup: {
        borderWidth: 1,
        borderColor: '#111111',
        backgroundColor: '#ffffff',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10
      },
      signupTxt: {
        color: '#111111',
        fontSize: 16,
        fontWeight: '600',
      },




})
