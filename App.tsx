import { StatusBar } from 'expo-status-bar';
import { Modal, ActivityIndicator, View, StyleSheet } from 'react-native';
import { useState } from 'react';
import LoginView from './src/screens/LoginView';
import SignupView from './src/screens/SignupView'
import WeatherMainView from './src/screens/WeatherMainView'
import SearchAreaView from './src/screens/SearchAreaView'
import MenuView from './src/screens/MenuView'
import PushManageView from './src/screens/PushManageView'
import { AuthProvider, useAuth } from './src/lib/AuthContext'

// Provider 안에서만 useAuth 를 쓸 수 있어서 화면 분기는 안쪽으로 분리
export default function App() {
  return (
    <AuthProvider>
      <AppRoute />
    </AuthProvider>
  )
}

function AppRoute() {
  const { isReady, profile } = useAuth() // profile 있으면 자동로그인(또는 방금 로그인)
  const [screen, setScreen] = useState<'login' | 'signup' | 'home' | 'search'>('login')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isPushManageOpen, setIsPushManageOpen] = useState(false)

  //임시값
  const [area, setArea] = useState({ name: '상암동', nx: 56, ny: 126 })

  // 세션 + tb_user 확인 전 — 로그인 화면이 깜빡이지 않게 스피너
  if (!isReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#111111" />
      </View>
    )
  }

  if (screen === 'signup') {
    return (
      <>
        <SignupView
          onCancel={() => setScreen('login')}
          onSignupSuccess={() => setScreen('login')}
        />
        <StatusBar style="dark" />
      </>
    )
  }

  // 로그인한 적 있고 세션이 살아 있으면 profile 이 채워짐 → 홈
  if (profile) {
    return (
      <>
        <WeatherMainView 
          area={area}
          onSearchPress={() => setIsSearchOpen(true)}
          onMenuPress={() => setIsMenuOpen(true)}
          />
          
          <Modal
            visible={isSearchOpen}
            animationType="slide"
            onRequestClose={() => setIsSearchOpen(false)}
          >
          <SearchAreaView
            onSelect={(selected) => {
              setArea(selected)
              setIsSearchOpen(false)
            }}
            onCancel={() => setIsSearchOpen(false)}
          />
       
        </Modal>

        <Modal
          visible={isPushManageOpen}
          animationType="slide"
          onRequestClose={() => setIsPushManageOpen(false)}
        >
          <PushManageView onClose={() => setIsPushManageOpen(false)} />
        </Modal>

        <MenuView
            visible={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onPushPress={() => {
              setIsMenuOpen(false)
              setIsPushManageOpen(true)
            }}
            onProfilePress={() => {}}
            onLogout={() => {
              setIsMenuOpen(false)
              setIsPushManageOpen(false)
              setScreen('login')
            }}
        />           
      </>
    )
  }

  // 나중에 로그인 후 지역정보가 없을 경우에 검색화면이 나오게 해야해서 놔두자
  if (screen === 'search') {
    return (
      <>
        <SearchAreaView 
          onSelect={(selected) => {
            setArea(selected)
            setScreen('home')
          }}
          onCancel={() => setScreen('home')}
        />
      </>
    )
  }

  // 원칙: 세션 없음 → 로그인
  return (
    <>
      <LoginView
        onGoSignup={() => setScreen('signup')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
