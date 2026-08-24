import { StatusBar } from 'expo-status-bar';
import { Modal, ActivityIndicator, View, StyleSheet } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import LoginView from './src/screens/LoginView';
import SignupView from './src/screens/SignupView'
import WeatherMainView from './src/screens/WeatherMainView'
import SearchAreaView from './src/screens/SearchAreaView'
import MenuView from './src/screens/MenuView'
import PushManageView from './src/screens/PushManageView'
import { AuthProvider, useAuth } from './src/lib/AuthContext'
import { DEFAULT_AREA, fetchGpsArea, WeatherArea } from './src/lib/currentArea'

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

  const [area, setArea] = useState<WeatherArea | null>(null)
  const [isSearchArea, setIsSearchArea] = useState(false)
  const isSearchAreaRef = useRef(false)

  // 검색으로 고른 지역이 없을 때만 GPS
  useEffect(() => {
    if (!profile) {
      isSearchAreaRef.current = false
      setIsSearchArea(false)
      setArea(null)
      return
    }
    if (isSearchArea) return

    let cancelled = false
    const loadGpsArea = async () => {
      const gpsArea = await fetchGpsArea()
      if (cancelled) return
      if (isSearchAreaRef.current) return
      setArea(gpsArea ?? DEFAULT_AREA)
    }
    loadGpsArea()
    return () => {
      cancelled = true
    }
  }, [profile, isSearchArea])

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
    if (!area) {
      return (
        <View style={styles.boot}>
          <ActivityIndicator color="#111111" />
        </View>
      )
    }

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
              isSearchAreaRef.current = true
              setIsSearchArea(true)
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
            isSearchAreaRef.current = true
            setIsSearchArea(true)
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
