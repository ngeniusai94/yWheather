import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// .env의 EXPO_PUBLIC_ 값을 읽음
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,      // 세션 저장소 (웹 localStorage 역할)
    autoRefreshToken: true,     // 토큰 만료 시 자동 갱신
    persistSession: true,       // 앱 재실행해도 로그인 유지
    detectSessionInUrl: false,  // URL 토큰 자동감지 끔 (RN용)
  },
})