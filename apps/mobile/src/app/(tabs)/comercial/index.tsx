import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { leadsApi } from '@kairon/core/api/leads.api';
import { usersApi } from '@kairon/core/api/users.api';
import { queryKeys } from '@kairon/core/entities/query-keys';
import { supabase } from '@kairon/core/supabase/client';

import { useAuth } from '@/auth/AuthContext';
import { Kairon } from '@/constants/kairon';
import {
  LEAD_STATUS_CONFIG,
  LEAD_STATUS_ORDER,
  ROLES_COMERCIAL,
  type LeadStatus,
} from '@/constants/leads';
import { LeadContactCard } from '@/components/LeadContactCard';
import { NovoLeadModal } from '@/components/NovoLeadModal';
import { MONTHS_LONG } from '@/lib/dates';
import type { Lead } from '@/types/models';

type Pessoa = { id: string; full_name?: string; email?: string; role?: string; status?: string };

type SecaoData = { key: string; label: string; leads: Lead[] };

/** Meia-noite local de uma data (para comparar por dia, sem horas). */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Agrupa leads (ja ordenados por created_at desc) em faixas de recencia: Hoje,
 * Esta semana, Este mes e, em seguida, um grupo por mes anterior (ex.: "Abril").
 * O ano so aparece no rotulo quando difere do ano atual.
 */
function agruparPorData(leads: Lead[]): SecaoData[] {
  const agora = new Date();
  const hojeTs = startOfDay(agora);
  const semanaTs = hojeTs - agora.getDay() * 24 * 60 * 60 * 1000; // domingo como inicio da semana
  const mesTs = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();

  const hoje: Lead[] = [];
  const semana: Lead[] = [];
  const mes: Lead[] = [];
  const anteriores = new Map<string, SecaoData>();

  for (const l of leads) {
    const d = new Date(l.created_at);
    const ts = startOfDay(d);
    if (ts >= hojeTs) hoje.push(l);
    else if (ts >= semanaTs) semana.push(l);
    else if (ts >= mesTs) mes.push(l);
    else {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let bucket = anteriores.get(key);
      if (!bucket) {
        const label =
          MONTHS_LONG[d.getMonth()] +
          (d.getFullYear() !== agora.getFullYear() ? ` ${d.getFullYear()}` : '');
        bucket = { key, label, leads: [] };
        anteriores.set(key, bucket);
      }
      bucket.leads.push(l);
    }
  }

  const out: SecaoData[] = [];
  if (hoje.length) out.push({ key: 'hoje', label: 'Hoje', leads: hoje });
  if (semana.length) out.push({ key: 'semana', label: 'Esta semana', leads: semana });
  if (mes.length) out.push({ key: 'mes', label: 'Este mês', leads: mes });
  for (const bucket of anteriores.values()) out.push(bucket);
  return out;
}

export default function ComercialScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const podeComercial = ROLES_COMERCIAL.includes(user?.role ?? '');
  const isAdmin = user?.role === 'admin';

  // Filtro de etapa (chips abaixo do titulo) — define qual lista aparece.
  const [statusFiltro, setStatusFiltro] = useState<LeadStatus>('pendente');
  // Filtro de responsavel (menu de vidro no header): 'todos' | 'meus' | <id>.
  const [responsavelFiltro, setResponsavelFiltro] = useState<'todos' | 'meus' | string>('todos');
  // Modal de cadastro manual de lead (apenas admin).
  const [novoVisible, setNovoVisible] = useState(false);

  const leadsQuery = useQuery({
    queryKey: queryKeys.leads.all,
    queryFn: leadsApi.list,
    enabled: podeComercial,
  });
  const usuariosQuery = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: usersApi.list,
    enabled: podeComercial,
  });

  const leads: Lead[] = leadsQuery.data ?? [];
  const usuarios: Pessoa[] = usuariosQuery.data ?? [];

  // Realtime: qualquer mudanca na tabela leads invalida a lista (paridade com o web).
  useEffect(() => {
    if (!podeComercial) return;
    const channel = supabase
      .channel('leads-realtime-mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [podeComercial, queryClient]);

  // SDR/BDR e admin ativos podem ser responsaveis (igual web).
  const responsaveis = useMemo(
    () =>
      usuarios.filter(
        (u) => (u.role === 'sdr' || u.role === 'bdr' || u.role === 'admin') && u.status === 'active'
      ),
    [usuarios]
  );

  // Leads ativos no pipeline (fora convertidos e perdidos), agrupados por etapa.
  // O filtro de responsavel NAO se aplica a Pendentes — sao leads "sem dono".
  const leadsPorStatus = useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = {
      pendente: [],
      em_atendimento: [],
      follow_up: [],
      reuniao_marcada: [],
      perdido: [],
    };
    for (const l of leads) {
      if (l.cliente_id || l.status === 'perdido') continue;
      if (!map[l.status]) continue;
      if (l.status !== 'pendente') {
        if (responsavelFiltro === 'meus' && l.responsavel_id !== user?.id) continue;
        if (
          responsavelFiltro !== 'todos' &&
          responsavelFiltro !== 'meus' &&
          l.responsavel_id !== responsavelFiltro
        )
          continue;
      }
      map[l.status].push(l);
    }
    for (const s of LEAD_STATUS_ORDER) {
      map[s].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    }
    return map;
  }, [leads, responsavelFiltro, user?.id]);

  const visiveis = leadsPorStatus[statusFiltro];
  const secoes = useMemo(() => agruparPorData(visiveis), [visiveis]);
  const canAssumir = user?.role === 'sdr' || user?.role === 'bdr' || user?.role === 'admin';

  const responsavelLabel = useMemo(() => {
    if (responsavelFiltro === 'todos') return 'Todos';
    if (responsavelFiltro === 'meus') return 'Meus leads';
    const p = responsaveis.find((x) => x.id === responsavelFiltro);
    return p?.full_name || p?.email || 'Responsável';
  }, [responsavelFiltro, responsaveis]);

  if (!podeComercial) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.semAcesso}>
          <Text style={styles.bigTitle}>Comercial</Text>
          <Text style={styles.semAcessoText}>Você não tem acesso ao pipeline comercial.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cfgAtual = LEAD_STATUS_CONFIG[statusFiltro];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={leadsQuery.isFetching}
            onRefresh={() => leadsQuery.refetch()}
            tintColor={Kairon.primary}
          />
        }>
        {/* Cabecalho */}
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.bigTitle}>Comercial</Text>
            <View style={styles.subRow}>
              <View
                style={[styles.subDot, responsavelFiltro !== 'todos' && styles.subDotActive]}
              />
              <Text style={styles.sub}>{responsavelLabel}</Text>
            </View>
          </View>
          <GlassView style={styles.filtroGlass} glassEffectStyle="regular" isInteractive>
            <Host style={styles.filtroHost}>
              <Menu
                label={
                  <UIImage
                    systemName="line.3.horizontal.decrease"
                    size={20}
                    color={responsavelFiltro !== 'todos' ? Kairon.primary : Kairon.text}
                  />
                }>
                <UIButton
                  systemImage={responsavelFiltro === 'todos' ? 'checkmark' : undefined}
                  onPress={() => setResponsavelFiltro('todos')}
                  label="Todos"
                />
                <UIButton
                  systemImage={responsavelFiltro === 'meus' ? 'checkmark' : undefined}
                  onPress={() => setResponsavelFiltro('meus')}
                  label="Meus leads"
                />
                {responsaveis.map((p) => (
                  <UIButton
                    key={p.id}
                    systemImage={responsavelFiltro === p.id ? 'checkmark' : undefined}
                    onPress={() => setResponsavelFiltro(p.id)}
                    label={p.full_name || p.email || 'Sem nome'}
                  />
                ))}
              </Menu>
            </Host>
          </GlassView>
        </View>

        {/* Chips de etapa (sticky) — App Store style. Ao selecionar, a lista reflui animada. */}
        <View style={styles.chipsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}>
            {LEAD_STATUS_ORDER.map((s) => {
              const cfg = LEAD_STATUS_CONFIG[s];
              const sel = statusFiltro === s;
              const count = leadsPorStatus[s].length;
              return (
                <Pressable
                  key={s}
                  onPress={() => setStatusFiltro(s)}
                  style={[
                    styles.chip,
                    sel && { backgroundColor: cfg.color, borderColor: cfg.color },
                  ]}>
                  <View
                    style={[
                      styles.chipDot,
                      { backgroundColor: sel ? '#0d0d0d' : cfg.color },
                    ]}
                  />
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{cfg.label}</Text>
                  {count > 0 ? (
                    <View style={[styles.chipBadge, sel && styles.chipBadgeSel]}>
                      <Text style={[styles.chipBadgeText, sel && styles.chipBadgeTextSel]}>
                        {count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Lista da etapa selecionada — anima a cada troca de filtro (key={statusFiltro}). */}
        <Animated.View
          key={statusFiltro}
          entering={FadeIn.duration(220)}
          style={{ paddingTop: screenH * 0.08 }}>
          {visiveis.length ? (
            secoes.map((secao, si) => {
              // Indice global acumulado para a cascata de entrada nao reiniciar por grupo.
              const offset = secoes.slice(0, si).reduce((acc, s) => acc + s.leads.length, 0);
              return (
                <View key={secao.key} style={si > 0 && styles.secaoGap}>
                  <Text style={[styles.secaoTitle, secao.key === 'hoje' && styles.secaoTitleHoje]}>
                    {secao.label}
                  </Text>
                  <View style={styles.group}>
                    {secao.leads.map((lead, i) => (
                      <Animated.View
                        key={lead.id}
                        entering={FadeInDown.delay(Math.min(offset + i, 14) * 45).duration(300)}>
                        <LeadContactCard
                          lead={lead}
                          first={i === 0}
                          canAssumir={canAssumir}
                          userId={user?.id}
                          onPress={() => router.push(`/comercial/${lead.id}`)}
                        />
                      </Animated.View>
                    ))}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.vazio}>
              <Text style={styles.vazioText}>
                {leadsQuery.isLoading
                  ? 'Carregando…'
                  : statusFiltro === 'pendente'
                    ? 'Nenhum lead novo no momento 🎉'
                    : `Nenhum lead em ${cfgAtual.label.toLowerCase()}`}
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* FAB de novo lead — apenas admin, logo acima da tab bar (lado direito). */}
      {isAdmin ? (
        <Pressable
          onPress={() => setNovoVisible(true)}
          style={[styles.fab, { bottom: insets.bottom + 24 }]}>
          <SymbolView name="plus" size={28} weight="semibold" tintColor="#fff" />
        </Pressable>
      ) : null}

      <NovoLeadModal
        key={novoVisible ? 'open' : 'closed'}
        visible={novoVisible}
        onClose={() => setNovoVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Kairon.bg },
  flex: { flex: 1 },
  content: { paddingBottom: 160 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  bigTitle: { color: Kairon.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  subDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Kairon.textMuted },
  subDotActive: { backgroundColor: Kairon.primary },
  sub: { color: Kairon.textMuted, fontSize: 14, fontWeight: '600' },
  filtroGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filtroHost: { width: 44, height: 44 },

  chipsBar: { backgroundColor: Kairon.bg, paddingTop: 8, paddingBottom: 6 },
  chipsContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    backgroundColor: Kairon.bgElevated,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { color: Kairon.textMuted, fontSize: 14, fontWeight: '600' },
  chipTextSel: { color: '#0d0d0d', fontWeight: '700' },
  chipBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  chipBadgeSel: { backgroundColor: 'rgba(13,13,13,0.18)' },
  chipBadgeText: { color: Kairon.textMuted, fontSize: 12, fontWeight: '700' },
  chipBadgeTextSel: { color: '#0d0d0d' },

  secaoGap: { marginTop: 22 },
  secaoTitle: {
    color: Kairon.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: 8,
  },
  // "Hoje" ganha destaque pela cor (branco), mantendo o mesmo tamanho.
  secaoTitleHoje: { color: Kairon.text },

  group: {
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: Kairon.bgElevated,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    overflow: 'hidden',
  },

  vazio: { marginHorizontal: 16, paddingHorizontal: 4, paddingVertical: 24, alignItems: 'center' },
  vazioText: { color: Kairon.textMuted, fontSize: 14, textAlign: 'center' },

  semAcesso: { flex: 1, padding: 16, gap: 12, justifyContent: 'center', alignItems: 'center' },
  semAcessoText: { color: Kairon.textMuted, fontSize: 15, textAlign: 'center' },

  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Kairon.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
