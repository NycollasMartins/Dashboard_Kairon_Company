// Polyfill de URL exigido pelo supabase-js no React Native — precisa vir antes
// de qualquer uso do client.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeQueryClient } from '@kairon/core/lib/query-client';
import { initSupabase } from '@kairon/core/supabase/client';

import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { Kairon } from '@/constants/kairon';

// Inicializa o client Supabase compartilhado com as variaveis do Expo, antes do
// primeiro acesso. AsyncStorage persiste a sessao entre aberturas do app.
initSupabase({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  authStorage: AsyncStorage,
});

const queryClient = makeQueryClient();

function RootNavigator() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoadingAuth) return;
    const inTabs = segments[0] === '(tabs)';
    if (!isAuthenticated && inTabs) {
      router.replace('/login');
    } else if (isAuthenticated && segments[0] === 'login') {
      router.replace('/');
    }
  }, [isAuthenticated, isLoadingAuth, segments, router]);

  if (isLoadingAuth) {
    return (
      <View style={{ flex: 1, backgroundColor: Kairon.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Kairon.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Kairon.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
