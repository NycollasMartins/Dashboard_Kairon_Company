import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { Card } from '@/components/kairon-ui';
import { Kairon } from '@/constants/kairon';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  head: 'Head de Squad',
  cs: 'Customer Success',
  dev: 'Desenvolvedor',
  'social media': 'Social Media',
  editor: 'Editor',
  designer: 'Designer',
  closer: 'Closer',
  sdr: 'SDR',
  bdr: 'BDR',
};

export default function PerfilScreen() {
  const { user, logout } = useAuth();
  const inicial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{inicial}</Text>
          </View>
          <Text style={styles.nome}>{user?.full_name || 'Usuário'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <Card>
          <View style={styles.linha}>
            <Text style={styles.label}>Função</Text>
            <Text style={styles.valor}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? '—'}</Text>
          </View>
        </Card>

        <Pressable onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Kairon.bg },
  content: { padding: 16, gap: 20 },
  header: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Kairon.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  nome: { color: Kairon.text, fontSize: 20, fontWeight: '700' },
  email: { color: Kairon.textMuted, fontSize: 14 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: Kairon.textMuted, fontSize: 14 },
  valor: { color: Kairon.text, fontSize: 14, fontWeight: '600' },
  logout: {
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { color: Kairon.red, fontSize: 15, fontWeight: '700' },
});
