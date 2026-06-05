import { Button as UIButton, Host, Menu } from '@expo/ui/swift-ui';
import { lineLimit, tint } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { leadsApi } from '@kairon/core/api/leads.api';
import { usersApi } from '@kairon/core/api/users.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { useAuth } from '@/auth/AuthContext';
import { Kairon } from '@/constants/kairon';
import {
  FATURAMENTO_MENSAL_OPTIONS,
  LEAD_STATUS_CONFIG,
  LEAD_STATUS_ORDER,
  MOMENTO_EMPRESA_OPTIONS,
  ORIGEM_OPTIONS,
  origemLabel,
  type LeadStatus,
} from '@/constants/leads';
import { initialsOf } from '@/lib/avatar';
import { callPhone, openWhatsApp } from '@/lib/contact';
import type { Lead } from '@/types/models';

type Pessoa = { id: string; full_name?: string; email?: string; role?: string; status?: string };
type Opcao = { id: string; label: string };

const WHATSAPP_GREEN = '#25D366';

const MOMENTO_OPTS: Opcao[] = MOMENTO_EMPRESA_OPTIONS.map((o) => ({ id: o, label: o }));
const FATURAMENTO_OPTS: Opcao[] = FATURAMENTO_MENSAL_OPTIONS.map((o) => ({ id: o, label: o }));

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

  // Alterna entre a ficha (read-only) e o formulario de edicao.
  const [editMode, setEditMode] = useState(false);

  // Form local, semeado a partir do lead. Usamos o padrao do React de ajustar estado
  // durante o render (guardado por id), ja que o lead chega assincronamente da cache.
  const [seededId, setSeededId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [origem, setOrigem] = useState('outbound');
  const [momento, setMomento] = useState<string | null>(null);
  const [faturamento, setFaturamento] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState('');
  const [status, setStatus] = useState<LeadStatus>('pendente');
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [notas, setNotas] = useState('');

  function seedFromLead(l: Lead) {
    setNome(l.nome);
    setEmpresa(l.empresa ?? '');
    setEmail(l.email ?? '');
    setTelefone(l.telefone ?? '');
    setOrigem(l.origem ?? 'outbound');
    setMomento(l.momento_empresa ?? null);
    setFaturamento(l.faturamento_mensal ?? null);
    setObjetivo(l.objetivo_principal ?? '');
    setStatus(l.status);
    setResponsavelId(l.responsavel_id);
    setNotas(l.notas ?? '');
  }

  if (lead && seededId !== lead.id) {
    setSeededId(lead.id);
    seedFromLead(lead);
  }

  const isAdmin = user?.role === 'admin';
  // Mesma regra do web: admin/closer editam tudo; sdr/bdr so pendentes ou os proprios.
  const canEdit =
    !!lead &&
    (user?.role === 'admin' ||
      user?.role === 'closer' ||
      ((user?.role === 'sdr' || user?.role === 'bdr') &&
        (lead.status === 'pendente' || lead.responsavel_id === user?.id)));

  const jaConvertido = !!lead?.cliente_id;
  const canDecidir = isAdmin && lead?.status === 'reuniao_marcada' && !jaConvertido;

  // Origem pode vir de valores fora do par inbound/outbound (ex.: manual). Mantemos a
  // opcao atual visivel no menu para nao "sumir" o valor.
  const origemOpts: Opcao[] = useMemo(() => {
    const base: Opcao[] = ORIGEM_OPTIONS.map((o) => ({ id: o.value, label: o.label }));
    if (origem && !base.some((o) => o.id === origem)) {
      base.unshift({ id: origem, label: origemLabel(origem) });
    }
    return base;
  }, [origem]);

  const dirty =
    !!lead &&
    (nome !== lead.nome ||
      (empresa || '') !== (lead.empresa || '') ||
      (email || '') !== (lead.email || '') ||
      (telefone || '') !== (lead.telefone || '') ||
      origem !== (lead.origem ?? 'outbound') ||
      (momento || null) !== (lead.momento_empresa || null) ||
      (faturamento || null) !== (lead.faturamento_mensal || null) ||
      (objetivo || '') !== (lead.objetivo_principal || '') ||
      status !== lead.status ||
      (responsavelId || null) !== (lead.responsavel_id || null) ||
      (notas || '') !== (lead.notas || ''));

  const salvar = useMutation({
    mutationFn: () =>
      leadsApi.update(id, {
        nome: nome.trim(),
        empresa: empresa.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        origem,
        momento_empresa: momento,
        faturamento_mensal: faturamento,
        objetivo_principal: objetivo.trim() || null,
        status,
        responsavel_id: responsavelId,
        notas,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      setEditMode(false);
    },
  });

  const marcarPerdido = useMutation({
    mutationFn: () => leadsApi.update(id, { status: 'perdido' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      router.back();
    },
  });

  const apagar = useMutation({
    mutationFn: () => leadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      router.back();
    },
  });

  const ocupado = salvar.isPending || marcarPerdido.isPending || apagar.isPending;

  function cancelarEdicao() {
    if (lead) seedFromLead(lead);
    setEditMode(false);
  }

  function confirmarPerdido() {
    Alert.alert('Marcar como Perdido', 'O lead sairá do pipeline. Deseja continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Marcar perdido', style: 'destructive', onPress: () => marcarPerdido.mutate() },
    ]);
  }

  function confirmarApagar() {
    Alert.alert(
      'Apagar lead',
      'Esta ação é permanente e não pode ser desfeita. Deseja apagar este lead?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: () => apagar.mutate() },
      ]
    );
  }

  if (!lead) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Topbar left={<BackButton onPress={() => router.back()} />} />
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
  const responsavelNome = lead.responsavel?.full_name || lead.responsavel?.email || null;
  const temTelefone = !!lead.telefone;
  const temEmail = !!lead.email;
  const podeSalvar = dirty && nome.trim().length > 0 && !ocupado;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Topbar
        left={
          editMode ? (
            <Pressable onPress={cancelarEdicao} hitSlop={10} disabled={ocupado}>
              <Text style={styles.cancel}>Cancelar</Text>
            </Pressable>
          ) : (
            <BackButton onPress={() => router.back()} />
          )
        }
        right={
          editMode ? (
            <Pressable onPress={() => salvar.mutate()} disabled={!podeSalvar} hitSlop={10}>
              <GlassPill
                label="Salvar"
                color={podeSalvar ? Kairon.primary : Kairon.textMuted}
                loading={salvar.isPending}
              />
            </Pressable>
          ) : canEdit ? (
            <Pressable onPress={() => setEditMode(true)} hitSlop={10}>
              <GlassPill label="Editar" color={Kairon.text} />
            </Pressable>
          ) : undefined
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {editMode ? (
            <Animated.View key="edit" entering={FadeIn.duration(220)}>
              <SectionHeader>Identificação</SectionHeader>
              <Card>
                <TextInput
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Nome do lead"
                  placeholderTextColor={Kairon.textMuted}
                  style={styles.cellInput}
                />
                <Divider />
                <TextInput
                  value={empresa}
                  onChangeText={setEmpresa}
                  placeholder="Empresa ou organização"
                  placeholderTextColor={Kairon.textMuted}
                  style={styles.cellInput}
                />
              </Card>

              <SectionHeader>Contato</SectionHeader>
              <Card>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={Kairon.textMuted}
                  style={styles.cellInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Divider />
                <TextInput
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor={Kairon.textMuted}
                  style={styles.cellInput}
                  keyboardType="phone-pad"
                />
              </Card>

              <SectionHeader>Qualificação</SectionHeader>
              <Card>
                <MenuRow
                  label="Origem"
                  value={origem}
                  options={origemOpts}
                  onChange={(v) => v && setOrigem(v)}
                  placeholder="Selecione"
                />
                <Divider />
                <MenuRow
                  label="Momento da empresa"
                  value={momento}
                  options={MOMENTO_OPTS}
                  onChange={setMomento}
                  placeholder="Selecione"
                />
                <Divider />
                <MenuRow
                  label="Faturamento mensal"
                  value={faturamento}
                  options={FATURAMENTO_OPTS}
                  onChange={setFaturamento}
                  placeholder="Selecione"
                />
              </Card>

              <SectionHeader>Objetivo principal</SectionHeader>
              <Card>
                <TextInput
                  value={objetivo}
                  onChangeText={setObjetivo}
                  placeholder="O que esse lead quer alcançar"
                  placeholderTextColor={Kairon.textMuted}
                  style={[styles.cellInput, styles.cellInputMultiline]}
                  multiline
                />
              </Card>

              <SectionHeader>Etapa</SectionHeader>
              <View style={styles.chips}>
                {LEAD_STATUS_ORDER.map((s) => {
                  const cfg = LEAD_STATUS_CONFIG[s];
                  const sel = status === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setStatus(s)}
                      style={[
                        styles.chip,
                        sel && { backgroundColor: `${cfg.color}22`, borderColor: cfg.color },
                      ]}>
                      <View style={[styles.chipDot, { backgroundColor: cfg.color }]} />
                      <Text style={[styles.chipText, sel && { color: cfg.color }]}>{cfg.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <SectionHeader>Responsável (SDR/BDR)</SectionHeader>
              <Card>
                <MenuRow
                  label="Responsável"
                  value={responsavelId}
                  options={responsaveis.map((r) => ({
                    id: r.id,
                    label: r.full_name || r.email || 'Sem nome',
                  }))}
                  onChange={setResponsavelId}
                  placeholder="Sem responsável"
                  allowClear
                  clearLabel="Sem responsável"
                />
              </Card>

              <SectionHeader>Notas internas</SectionHeader>
              <Card>
                <TextInput
                  value={notas}
                  onChangeText={setNotas}
                  placeholder="Anotações, próximos passos, contexto…"
                  placeholderTextColor={Kairon.textMuted}
                  style={[styles.cellInput, styles.cellInputMultiline]}
                  multiline
                />
              </Card>

              {salvar.isError ? (
                <Text style={styles.erro}>Não foi possível salvar. Tente novamente.</Text>
              ) : null}

              {canDecidir ? (
                <Pressable
                  onPress={confirmarPerdido}
                  disabled={ocupado}
                  style={[styles.perdidoBtn, styles.mt]}>
                  {marcarPerdido.isPending ? (
                    <ActivityIndicator color={Kairon.red} />
                  ) : (
                    <Text style={styles.perdidoText}>Marcar como Perdido</Text>
                  )}
                </Pressable>
              ) : null}

              {isAdmin ? (
                <Pressable
                  onPress={confirmarApagar}
                  disabled={ocupado}
                  style={[styles.apagarBtn, styles.mt]}>
                  {apagar.isPending ? (
                    <ActivityIndicator color={Kairon.red} />
                  ) : (
                    <>
                      <SymbolView name="trash" size={16} tintColor={Kairon.red} />
                      <Text style={styles.apagarText}>Apagar lead</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </Animated.View>
          ) : (
            <Animated.View key="view" entering={FadeIn.duration(220)}>
              {/* Cabecalho estilo Contatos: avatar grande, nome, empresa, status. */}
              <View style={styles.hero}>
                <View style={[styles.bigAvatar, { backgroundColor: `${statusCfg.color}22` }]}>
                  <Text style={[styles.bigAvatarText, { color: statusCfg.color }]}>
                    {initialsOf(lead.nome)}
                  </Text>
                </View>
                <Text style={styles.nome}>{lead.nome}</Text>
                <Text style={styles.empresa}>{lead.empresa || 'Sem empresa informada'}</Text>

                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${statusCfg.color}22`, borderColor: statusCfg.color },
                    ]}>
                    <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                    <Text style={[styles.statusPillText, { color: statusCfg.color }]}>
                      {statusCfg.label}
                    </Text>
                  </View>
                  {jaConvertido ? (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: `${Kairon.emerald}22`, borderColor: Kairon.emerald },
                      ]}>
                      <Text style={[styles.statusPillText, { color: Kairon.emerald }]}>
                        Convertido{lead.cliente?.nome ? `: ${lead.cliente.nome}` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Botoes de acao circulares (Contatos). */}
              <Animated.View entering={FadeInDown.delay(60).duration(280)} style={styles.actionsRow}>
                <ActionCircle
                  icon="phone.fill"
                  label="Ligar"
                  disabled={!temTelefone}
                  onPress={() => callPhone(lead.telefone)}
                />
                <ActionCircle
                  icon="message.fill"
                  label="WhatsApp"
                  tint={WHATSAPP_GREEN}
                  disabled={!temTelefone}
                  onPress={() => openWhatsApp(lead.telefone)}
                />
                <ActionCircle
                  icon="envelope.fill"
                  label="E-mail"
                  disabled={!temEmail}
                  onPress={() => lead.email && Linking.openURL(`mailto:${lead.email}`)}
                />
              </Animated.View>

              {/* Cartao de informacoes (inset grouped, estilo Contatos). */}
              <Animated.View entering={FadeInDown.delay(120).duration(280)} style={styles.card}>
                <Field
                  label="celular"
                  value={lead.telefone}
                  trailing={
                    temTelefone ? (
                      <Pressable onPress={() => callPhone(lead.telefone)} hitSlop={8}>
                        <SymbolView name="phone.fill" size={18} tintColor={Kairon.primary} />
                      </Pressable>
                    ) : undefined
                  }
                />
                <Field label="e-mail" value={lead.email} />
                <Field label="momento da empresa" value={lead.momento_empresa} />
                <Field label="faturamento mensal" value={lead.faturamento_mensal} />
                <Field label="objetivo principal" value={lead.objetivo_principal} />
                <Field label="origem" value={origemLabel(lead.origem)} last />
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(160).duration(280)} style={styles.card}>
                <Field label="responsável" value={responsavelNome} />
                <Field label="notas internas" value={lead.notas} last />
              </Animated.View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ----- Cabecalho -----

function Topbar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.topbar}>
      <View style={styles.topSide}>{left}</View>
      <View style={[styles.topSide, styles.topRight]}>{right}</View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <GlassView style={styles.backBtn} glassEffectStyle="regular" isInteractive>
        <SymbolView name="chevron.left" size={18} tintColor={Kairon.text} />
      </GlassView>
    </Pressable>
  );
}

function GlassPill({
  label,
  color,
  loading,
}: {
  label: string;
  color: string;
  loading?: boolean;
}) {
  return (
    <GlassView style={styles.pill} glassEffectStyle="regular" isInteractive>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.pillText, { color }]}>{label}</Text>
      )}
    </GlassView>
  );
}

// ----- Acoes (modo ficha) -----

function ActionCircle({
  icon,
  label,
  onPress,
  disabled,
  tint: tintColor,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, disabled && styles.actionDisabled]}>
      <View style={styles.actionCircle}>
        <SymbolView
          name={icon}
          size={22}
          tintColor={disabled ? Kairon.textMuted : tintColor ?? Kairon.primary}
        />
      </View>
      <Text style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  trailing,
  last,
}: {
  label: string;
  value?: string | null;
  trailing?: ReactNode;
  last?: boolean;
}) {
  const vazio = !value;
  return (
    <View style={[styles.field, !last && styles.fieldSep]}>
      <View style={styles.flex}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, vazio && styles.fieldValueEmpty]}>{value || '—'}</Text>
      </View>
      {trailing}
    </View>
  );
}

// ----- Primitivos do formulario (estilo NovoLeadModal) -----

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.formCard}>{children}</View>;
}

function SectionHeader({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function Divider() {
  return <View style={styles.formDivider} />;
}

function MenuRow({
  label,
  value,
  options,
  onChange,
  placeholder,
  allowClear,
  clearLabel,
}: {
  label: string;
  value: string | null;
  options: Opcao[];
  onChange: (id: string | null) => void;
  placeholder: string;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const selecionada = options.find((o) => o.id === value);
  return (
    <View style={styles.formRow}>
      <Text style={styles.formRowLabel}>{label}</Text>
      <View style={styles.formRowValue}>
        <Host matchContents>
          <Menu
            label={selecionada ? selecionada.label : placeholder}
            systemImage="chevron.up.chevron.down"
            modifiers={[tint(Kairon.textMuted), lineLimit(1)]}>
            {allowClear ? (
              <UIButton
                systemImage={!value ? 'checkmark' : undefined}
                onPress={() => onChange(null)}
                label={clearLabel ?? 'Limpar'}
              />
            ) : null}
            {options.map((o) => (
              <UIButton
                key={o.id}
                systemImage={o.id === value ? 'checkmark' : undefined}
                onPress={() => onChange(o.id)}
                label={o.label}
              />
            ))}
          </Menu>
        </Host>
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
    paddingVertical: 8,
    minHeight: 56,
  },
  topSide: { minWidth: 80, justifyContent: 'center' },
  topRight: { alignItems: 'flex-end' },
  cancel: { color: Kairon.primary, fontSize: 16, fontWeight: '600' },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pill: {
    height: 40,
    minWidth: 80,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillText: { fontSize: 16, fontWeight: '700' },

  content: { padding: 16, paddingBottom: 160 },

  // Ficha (read-only)
  hero: { alignItems: 'center', paddingTop: 8 },
  bigAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  bigAvatarText: { fontSize: 38, fontWeight: '700' },
  nome: { color: Kairon.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  empresa: { color: Kairon.textMuted, fontSize: 15, marginTop: 4, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' },
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

  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 22 },
  action: { alignItems: 'center', gap: 7 },
  actionDisabled: { opacity: 0.4 },
  actionCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Kairon.bgElevated,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: Kairon.text, fontSize: 12, fontWeight: '600' },
  actionLabelDisabled: { color: Kairon.textMuted },

  card: {
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: Kairon.bgElevated,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    overflow: 'hidden',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  fieldSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Kairon.cardBorder },
  fieldLabel: {
    color: Kairon.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  fieldValue: { color: Kairon.text, fontSize: 16 },
  fieldValueEmpty: { color: Kairon.textMuted },

  // Formulario (edicao)
  formCard: {
    backgroundColor: Kairon.bgElevated,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  sectionHeader: {
    color: Kairon.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 8,
    marginLeft: 14,
  },
  formDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Kairon.cardBorder,
    marginLeft: 16,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    gap: 12,
  },
  formRowLabel: { color: Kairon.text, fontSize: 16 },
  formRowValue: { marginLeft: 'auto', maxWidth: '62%', alignItems: 'flex-end' },

  cellInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Kairon.text,
    fontSize: 16,
  },
  cellInputMultiline: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },

  mt: { marginTop: 14 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
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
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: Kairon.text, fontSize: 13, fontWeight: '600' },

  erro: { color: Kairon.red, fontSize: 13, marginTop: 14, marginLeft: 14 },

  perdidoBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Kairon.red}55`,
    backgroundColor: `${Kairon.red}14`,
    alignItems: 'center',
  },
  perdidoText: { color: Kairon.red, fontSize: 15, fontWeight: '700' },

  apagarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  apagarText: { color: Kairon.red, fontSize: 15, fontWeight: '700' },
});
