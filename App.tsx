import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import LoginView from './src/screens/LoginView';
import SignupView from './src/screens/SignupView'
import HomeView from './src/screens/HomeView'

export default function App() {
  const [screen, setScreen] = useState<'login' | 'signup' | 'home'>('login')

  if(screen === 'signup') {
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

  if (screen === 'home') {
    return (
      <>
        <HomeView onLogout={() => setScreen('login')} />
        <StatusBar style="dark" />
      </>
    )
  }
  
  return (
    <>
      <LoginView
        onGoSignup={() => setScreen('signup')} 
        onLoginSuccess={() => setScreen('home')}
      />
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
