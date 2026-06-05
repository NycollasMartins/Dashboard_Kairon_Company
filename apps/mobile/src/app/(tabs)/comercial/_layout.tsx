import { Stack } from 'expo-router';

import { Kairon } from '@/constants/kairon';

/**
 * Stack aninhado da tab Comercial: a lista (index) empilha a tela de detalhe do
 * lead ([id]). Header oculto — cada tela desenha o proprio cabecalho, no padrao
 * das demais telas do app.
 */
export default function ComercialLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Kairon.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
