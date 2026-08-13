import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import LoginView from './src/screens/LoginView';
import SignupView from './src/screens/SignupView'
import WeatherMainView from './src/screens/WeatherMainView'


export default function App() {
  const [screen, setScreen] = useState<'login' | 'signup' | 'home'>('home')

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
        <WeatherMainView onLogout={() => setScreen('login')} />
      </>
    )
  }
  
  return (
    <>
      <LoginView
        onGoSignup={() => setScreen('signup')}
        onLoginSuccess={() => setScreen('home')}
      />
      {/* <WeatherMainView onLogout={() => setScreen('login')} /> */}
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
