import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@kairon/core/supabase/client';

import { Kairon } from '@/constants/kairon';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeEntrar = email.trim().length > 0 && senha.length >= 6 && !loading;

  async function entrar() {
    if (!podeEntrar) return;
    setErro(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setLoading(false);
    if (error) {
      setErro('E-mail ou senha inválidos.');
      return;
    }
    // Sucesso: o onAuthStateChange no AuthProvider dispara o redirect (via _layout).
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.brand}>
            <View style={styles.logoDot} />
            <Text style={styles.brandText}>Kairon Company</Text>
            <Text style={styles.subtitle}>Acesse seu painel operacional</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="voce@empresa.com"
              placeholderTextColor={Kairon.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Senha</Text>
            <TextInput
              value={senha}
              onChangeText={setSenha}
              placeholder="••••••••"
              placeholderTextColor={Kairon.textMuted}
              secureTextEntry
              style={styles.input}
              onSubmitEditing={entrar}
              returnKeyType="go"
            />

            {erro ? <Text style={styles.erro}>{erro}</Text> : null}

            <Pressable
              onPress={entrar}
              disabled={!podeEntrar}
              style={[styles.botao, !podeEntrar && styles.botaoDisabled]}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botaoText}>Entrar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: Kairon.bg },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 40 },
  brand: { alignItems: 'center', gap: 8 },
  logoDot: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Kairon.primary,
    marginBottom: 8,
  },
  brandText: { color: Kairon.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: Kairon.textMuted, fontSize: 14 },
  form: { gap: 4 },
  label: { color: Kairon.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: Kairon.bgElevated,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Kairon.text,
    fontSize: 16,
  },
  erro: { color: Kairon.red, fontSize: 13, marginTop: 12 },
  botao: {
    marginTop: 24,
    backgroundColor: Kairon.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  botaoDisabled: { opacity: 0.5 },
  botaoText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
