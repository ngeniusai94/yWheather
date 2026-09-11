import { StatusBar } from 'expo-status-bar';
import { Modal, ActivityIndicator, View, StyleSheet, Alert } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import LoginView from './src/screens/LoginView';
import SignupView from './src/screens/SignupView'
import WeatherMainView from './src/screens/WeatherMainView'
import SearchAreaView from './src/screens/SearchAreaView'
import MenuView from './src/screens/MenuView'
import PushManageView from './src/screens/PushManageView'
import ProfileManageView from './src/screens/ProfileManageView'
import { AuthProvider, useAuth } from './src/lib/AuthContext'
import { DEFAULT_AREA, fetchGpsArea, WeatherArea } from './src/lib/currentArea'
import { setupFcmListeners } from './src/lib/fcmPush'

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
  const [isGuest, setIsGuest] = useState(false) // 둘러보기 (비로그인)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isPushManageOpen, setIsPushManageOpen] = useState(false)
  const [isProfileManageOpen, setIsProfileManageOpen] = useState(false)

  const [area, setArea] = useState<WeatherArea | null>(null)
  const [isSearchArea, setIsSearchArea] = useState(false)
  const isSearchAreaRef = useRef(false)

  const canUseWeather = !!profile || isGuest

  // FCM 수신 로그 — 로그인 후에만 (비로그인은 토큰/기기 등록 없음)
  useEffect(() => {
    if (!profile) return
    return setupFcmListeners()
  }, [profile])

  // 검색으로 고른 지역이 없을 때만 GPS (로그인·둘러보기 모두)
  useEffect(() => {
    if (!canUseWeather) {
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
  }, [canUseWeather, isSearchArea])

  const goLogin = () => {
    setIsGuest(false)
    setIsMenuOpen(false)
    setIsPushManageOpen(false)
    setIsProfileManageOpen(false)
    setScreen('login')
  }

  const requireLogin = (featureName: string) => {
    setIsMenuOpen(false)
    Alert.alert('알림', `${featureName}은 로그인 후 이용할 수 있습니다.`, [
      { text: '취소', style: 'cancel' },
      { text: '로그인', onPress: goLogin },
    ])
  }

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

  // 로그인 또는 둘러보기 → 날씨 홈
  if (canUseWeather) {
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

        <Modal
          visible={isProfileManageOpen}
          animationType="slide"
          onRequestClose={() => setIsProfileManageOpen(false)}
        >
          <ProfileManageView
            onClose={() => setIsProfileManageOpen(false)}
            onWithdrawn={goLogin}
          />
        </Modal>

        <MenuView
            visible={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onPushPress={() => {
              if (!profile) {
                requireLogin('날씨 알림')
                return
              }
              setIsMenuOpen(false)
              setIsPushManageOpen(true)
            }}
            onProfilePress={() => {
              if (!profile) {
                requireLogin('내 정보 관리')
                return
              }
              setIsMenuOpen(false)
              setIsProfileManageOpen(true)
            }}
            onLogout={goLogin}
            onLoginPress={goLogin}
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
        onBrowse={() => {
          setIsGuest(true)
          setScreen('home')
        }}
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
