import { Button as UIButton, Host, Menu } from '@expo/ui/swift-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { leadsApi } from '@kairon/core/api/leads.api';
import { usersApi } from '@kairon/core/api/users.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { useAuth } from '@/auth/AuthContext';
import { Kairon } from '@/constants/kairon';
import {
  LEAD_STATUS_CONFIG,
  LEAD_STATUS_ORDER,
  origemLabel,
  type LeadStatus,
} from '@/constants/leads';
import { callPhone, openWhatsApp } from '@/lib/contact';
import type { Lead } from '@/types/models';

type Pessoa = { id: string; full_name?: string; email?: string; role?: string; status?: string };

export default function LeadDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const leadsQuery = useQuery({ queryKey: queryKeys.leads.all, queryFn: leadsApi.list });
  const usuariosQuery = useQuery({ queryKey: queryKeys.usuarios.all, queryFn: usersApi.list });

  const lead: Lead | undefined = useMemo(
    () => (leadsQuery.data ?? []).find((l: Lead) => l.id === id),
    [leadsQuery.data, id]
  );

  const responsaveis: Pessoa[] = useMemo(
    () =>
      (usuariosQuery.data ?? []).filter(
        (u: Pessoa) => (u.role === 'sdr' || u.role === 'bdr') && u.status === 'active'
      ),
    [usuariosQuery.data]
  );

  // Form local (status / responsavel / notas), semeado a partir do lead. Usamos o
  // padrao do React de ajustar estado durante o render (guardado por id) em vez de
  // um effect, ja que o lead chega de forma assincrona da cache.
  const [seededId, setSeededId] = useState<string | null>(null);
  const [status, setStatus] = useState<LeadStatus>('pendente');
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [notas, setNotas] = useState('');

  if (lead && seededId !== lead.id) {
    setSeededId(lead.id);
    setStatus(lead.status);
    setResponsavelId(lead.responsavel_id);
    setNotas(lead.notas ?? '');
  }

  const isAdmin = user?.role === 'admin';
  // Mesma regra do web (LeadDetalheModal): admin/closer editam tudo; sdr/bdr so
  // pendentes ou os proprios.
  const canEdit =
    !!lead &&
    (user?.role === 'admin' ||
      user?.role === 'closer' ||
      ((user?.role === 'sdr' || user?.role === 'bdr') &&
        (lead.status === 'pendente' || lead.responsavel_id === user?.id)));

  const jaConvertido = !!lead?.cliente_id;
  const canDecidir = isAdmin && lead?.status === 'reuniao_marcada' && !jaConvertido;

  const dirty =
    !!lead &&
    (status !== lead.status ||
      (responsavelId || null) !== (lead.responsavel_id || null) ||
      (notas || '') !== (lead.notas || ''));

  const salvar = useMutation({
    mutationFn: () => leadsApi.update(id, { status, responsavel_id: responsavelId, notas }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      router.back();
    },
  });

  const marcarPerdido = useMutation({
    mutationFn: () => leadsApi.update(id, { status: 'perdido' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      router.back();
    },
  });

  const ocupado = salvar.isPending || marcarPerdido.isPending;

  function confirmarPerdido() {
    Alert.alert('Marcar como Perdido', 'O lead sairá do pipeline. Deseja continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Marcar perdido', style: 'destructive', onPress: () => marcarPerdido.mutate() },
    ]);
  }

  if (!lead) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Topbar onBack={() => router.back()} title="Lead" />
        <View style={styles.center}>
          {leadsQuery.isLoading ? (
            <ActivityIndicator color={Kairon.primary} />
          ) : (
            <Text style={styles.emptyText}>Lead não encontrado.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = LEAD_STATUS_CONFIG[lead.status];
  const responsavelLabel =
    responsaveis.find((r) => r.id === responsavelId)?.full_name ||
    responsaveis.find((r) => r.id === responsavelId)?.email ||
    'Sem responsável';
  const temTelefone = !!lead.telefone;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Topbar
        onBack={() => router.back()}
        title="Lead"
        right={
          canEdit ? (
            <Pressable onPress={() => salvar.mutate()} disabled={!dirty || ocupado} hitSlop={10}>
              {salvar.isPending ? (
                <ActivityIndicator color={Kairon.primary} />
              ) : (
                <Text style={[styles.save, (!dirty || ocupado) && styles.saveDisabled]}>Salvar</Text>
              )}
            </Pressable>
          ) : undefined
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Cabecalho */}
          <Text style={styles.nome}>{lead.nome}</Text>
          <Text style={styles.empresa}>{lead.empresa || 'Sem empresa informada'}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusPill, { backgroundColor: `${statusCfg.color}22`, borderColor: statusCfg.color }]}>
              <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
              <Text style={[styles.statusPillText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
            {jaConvertido ? (
              <View style={[styles.statusPill, { backgroundColor: `${Kairon.emerald}22`, borderColor: Kairon.emerald }]}>
                <Text style={[styles.statusPillText, { color: Kairon.emerald }]}>
                  Convertido{lead.cliente?.nome ? `: ${lead.cliente.nome}` : ''}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Acoes de contato */}
          <View style={styles.contatoRow}>
            <ContatoBtn
              label="Ligar"
              disabled={!temTelefone}
              onPress={() => callPhone(lead.telefone)}
            />
            <ContatoBtn
              label="WhatsApp"
              disabled={!temTelefone}
              onPress={() => openWhatsApp(lead.telefone)}
            />
          </View>

          {/* Campos read-only */}
          <ReadOnly label="E-mail" value={lead.email} />
          <ReadOnly label="Telefone" value={lead.telefone} />
          <ReadOnly label="Momento da Empresa" value={lead.momento_empresa} />
          <ReadOnly label="Faturamento Mensal" value={lead.faturamento_mensal} />
          <ReadOnly label="Objetivo Principal" value={lead.objetivo_principal} />
          <ReadOnly label="Origem" value={origemLabel(lead.origem)} />

          {/* Secao editavel */}
          <View style={styles.divider} />

          <Text style={[styles.label, styles.mt]}>Status</Text>
          <View style={styles.chips}>
            {LEAD_STATUS_ORDER.map((s) => {
              const cfg = LEAD_STATUS_CONFIG[s];
              const sel = status === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => canEdit && setStatus(s)}
                  disabled={!canEdit}
                  style={[
                    styles.chip,
                    sel && { backgroundColor: `${cfg.color}22`, borderColor: cfg.color },
                    !canEdit && styles.chipDisabled,
                  ]}>
                  <View style={[styles.chipDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.chipText, sel && { color: cfg.color }]}>{cfg.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, styles.mt]}>Responsável (SDR/BDR)</Text>
          <GlassView style={styles.respGlass} glassEffectStyle="regular" isInteractive>
            <Host style={styles.respHost}>
              <Menu label={responsavelLabel}>
                <UIButton
                  systemImage={!responsavelId ? 'checkmark' : undefined}
                  onPress={() => canEdit && setResponsavelId(null)}
                  label="Sem responsável"
                />
                {responsaveis.map((r) => (
                  <UIButton
                    key={r.id}
                    systemImage={responsavelId === r.id ? 'checkmark' : undefined}
                    onPress={() => canEdit && setResponsavelId(r.id)}
                    label={r.full_name || r.email || 'Sem nome'}
                  />
                ))}
              </Menu>
            </Host>
          </GlassView>

          <Text style={[styles.label, styles.mt]}>Notas internas</Text>
          <TextInput
            value={notas}
            onChangeText={setNotas}
            editable={canEdit}
            multiline
            placeholder="Anotações, próximos passos, contexto…"
            placeholderTextColor={Kairon.textMuted}
            style={[styles.input, styles.textarea, !canEdit && styles.inputDisabled]}
          />

          {!canEdit ? (
            <Text style={styles.aviso}>
              Você só pode editar leads pendentes ou nos quais já é responsável.
            </Text>
          ) : null}

          {salvar.isError ? (
            <Text style={styles.erro}>Não foi possível salvar. Tente novamente.</Text>
          ) : null}

          {canDecidir ? (
            <Pressable onPress={confirmarPerdido} disabled={ocupado} style={[styles.perdidoBtn, styles.mt]}>
              {marcarPerdido.isPending ? (
                <ActivityIndicator color={Kairon.red} />
              ) : (
                <Text style={styles.perdidoText}>Marcar como Perdido</Text>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Topbar({
  onBack,
  title,
  right,
}: {
  onBack: () => void;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.topbar}>
      <Pressable onPress={onBack} hitSlop={10}>
        <Text style={styles.back}>‹ Voltar</Text>
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.topRight}>{right}</View>
    </View>
  );
}

function ContatoBtn({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.contatoBtn, disabled && styles.contatoBtnDisabled]}>
      <Text style={[styles.contatoBtnText, disabled && styles.contatoBtnTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function ReadOnly({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.mt}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.readBox}>
        <Text style={styles.readText}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: Kairon.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Kairon.textMuted, fontSize: 14 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Kairon.cardBorder,
  },
  back: { color: Kairon.primary, fontSize: 16, fontWeight: '600' },
  topTitle: { color: Kairon.text, fontSize: 16, fontWeight: '700' },
  topRight: { minWidth: 64, alignItems: 'flex-end' },
  save: { color: Kairon.primary, fontSize: 15, fontWeight: '700' },
  saveDisabled: { color: Kairon.textMuted, opacity: 0.6 },

  content: { padding: 16, paddingBottom: 160 },
  nome: { color: Kairon.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  empresa: { color: Kairon.textMuted, fontSize: 15, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  contatoRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  contatoBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Kairon.primary,
    alignItems: 'center',
  },
  contatoBtnDisabled: { backgroundColor: Kairon.bgElevated, borderWidth: 1, borderColor: Kairon.cardBorder },
  contatoBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  contatoBtnTextDisabled: { color: Kairon.textMuted },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Kairon.cardBorder,
    marginTop: 24,
  },

  label: { color: Kairon.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  mt: { marginTop: 14 },
  readBox: {
    backgroundColor: Kairon.bgElevated,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readText: { color: Kairon.text, fontSize: 15 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    backgroundColor: Kairon.bgElevated,
  },
  chipDisabled: { opacity: 0.6 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: Kairon.text, fontSize: 13, fontWeight: '600' },

  respGlass: { borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start' },
  respHost: { height: 44, minWidth: 180, paddingHorizontal: 4 },

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
  inputDisabled: { opacity: 0.6 },
  textarea: { minHeight: 96, textAlignVertical: 'top' },

  aviso: {
    color: Kairon.textMuted,
    fontSize: 12,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  erro: { color: Kairon.red, fontSize: 13, marginTop: 14 },

  perdidoBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Kairon.red}55`,
    backgroundColor: `${Kairon.red}14`,
    alignItems: 'center',
  },
  perdidoText: { color: Kairon.red, fontSize: 15, fontWeight: '700' },
});
