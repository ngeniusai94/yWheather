import { View, Text, Pressable, StyleSheet } from 'react-native'
import { supabase } from '../lib/supabaseClient'

type HomeViewProps = {
  onLogout?: () => void
}

export default function HomeView({ onLogout }: HomeViewProps) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout?.()
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>yWeather</Text>
      <Text style={styles.subtitle}>로그인 성공 (임시 홈)</Text>
      <Pressable style={styles.btn} onPress={handleLogout}>
        <Text style={styles.btnTxt}>로그아웃</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // 화이트
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111111', // 검정
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b6b6b', // 회색
    marginBottom: 32,
  },
  btn: {
    backgroundColor: '#111111', // 검정
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  btnTxt: {
    color: '#ffffff', // 화이트
    fontSize: 16,
    fontWeight: '600',
  },
})