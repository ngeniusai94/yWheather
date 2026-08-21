import { View, Text, StyleSheet, Pressable, TextInput,
    Keyboard,
    TouchableWithoutFeedback, //빈 곳 터치 시 키보드 닫기
} from 'react-native'
import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

type LoginViewProps = {
    onGoSignup?: () => void
}

export default function LoginView({onGoSignup}: LoginViewProps) {
    const { signIn } = useAuth() // Auth / tb_user 조회는 Context 가 담당
    const [userId, setUserId] = useState('')
    const [password, setPassword] = useState('')
    
    const handleLogin = async () => {
        Keyboard.dismiss()
        const trimUserId = userId.trim()
        if(!trimUserId || !password) {
            alert('아이디와 비밀번호를 입력해주세요.')
            return
        }

        const failMessage = await signIn(trimUserId, password)
        if (failMessage) {
            alert(failMessage)
            return
        }
        // 성공 시 profile 이 채워지고 AppRoute 가 WeatherMainView 로 전환
    }

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
            <Text style={styles.brand}>날씨 톡톡</Text>

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
