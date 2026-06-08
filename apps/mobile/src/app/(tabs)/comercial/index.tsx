import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { leadsApi } from '@kairon/core/api/leads.api';
import { queryKeys } from '@kairon/core/entities/query-keys';
import { supabase } from '@kairon/core/supabase/client';

import { useAuth } from '@/auth/AuthContext';
import { useLeadBadge } from '@/notifications/LeadBadgeContext';
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
  const { markLeadsRead } = useLeadBadge();
  const { height: screenH } = useWindowDimensions();

  const podeComercial = ROLES_COMERCIAL.includes(user?.role ?? '');

  // Abrir a tela Comercial = "viu os leads": zera o badge (tab + ícone do app).
  useFocusEffect(
    useCallback(() => {
      if (podeComercial) markLeadsRead();
    }, [podeComercial, markLeadsRead]),
  );
  const isAdmin = user?.role === 'admin';

  // Filtro de etapa (chips abaixo do titulo) — define qual lista aparece.
  const [statusFiltro, setStatusFiltro] = useState<LeadStatus>('pendente');
  // Modal de cadastro manual de lead (apenas admin).
  const [novoVisible, setNovoVisible] = useState(false);

  const leadsQuery = useQuery({
    queryKey: queryKeys.leads.all,
    queryFn: leadsApi.list,
    enabled: podeComercial,
  });

  const leads: Lead[] = leadsQuery.data ?? [];

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

  // Leads ativos no pipeline (fora convertidos e perdidos), agrupados por etapa.
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
      map[l.status].push(l);
    }
    for (const s of LEAD_STATUS_ORDER) {
      map[s].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    }
    return map;
  }, [leads]);

  const visiveis = leadsPorStatus[statusFiltro];
  const secoes = useMemo(() => agruparPorData(visiveis), [visiveis]);
  const canAssumir = user?.role === 'sdr' || user?.role === 'bdr' || user?.role === 'admin';

  if (!podeComercial) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.semAcesso}>
          <Text style={styles.bigTitle}>Leads</Text>
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
          {/* Espacador para equilibrar as acoes a direita e manter o titulo centralizado. */}
          <View style={[styles.headerSide, { width: isAdmin ? 44 : 0 }]} />
          <View style={styles.headerCenter}>
            <Text style={styles.bigTitle}>Leads</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Novo lead (admin) — botao de vidro. */}
            {isAdmin ? (
              <Pressable onPress={() => setNovoVisible(true)}>
                <GlassView style={styles.filtroGlass} glassEffectStyle="regular" isInteractive>
                  <SymbolView name="plus" size={20} weight="semibold" tintColor={Kairon.text} />
                </GlassView>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Chips de etapa (sticky) — App Store style. Ao selecionar, a lista reflui animada. */}
        <View style={[styles.chipsBar, { paddingTop: screenH * 0.025 }]}>
          <View style={styles.chipsContent}>
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
                    sel && { borderColor: cfg.color },
                  ]}>
                  <View style={[styles.chipDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{cfg.label}</Text>
                  {count > 0 ? (
                    <View style={styles.chipBadge}>
                      <Text style={styles.chipBadgeText}>{count}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {/* Divider separando a secao de chips do inicio da lista de leads. */}
          <View style={styles.chipsDivider} />
        </View>

        {/* Lista da etapa selecionada — anima a cada troca de filtro (key={statusFiltro}). */}
        <Animated.View
          key={statusFiltro}
          entering={FadeIn.duration(220)}
          style={{ paddingTop: screenH * 0.04 }}>
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
  content: { paddingBottom: 160 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerSide: { width: 44 },
  headerCenter: { flex: 1, alignItems: 'center' },
  bigTitle: {
    color: Kairon.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filtroGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  chipsBar: { backgroundColor: Kairon.bg, paddingTop: 8, paddingBottom: 6 },
  chipsContent: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  chipsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Kairon.cardBorder,
    marginTop: 12,
    marginHorizontal: 16,
  },
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
  // Selecionado: so o texto ganha destaque (branco/bold); a cor da etapa vai no contorno.
  chipTextSel: { color: Kairon.text, fontWeight: '700' },
  chipBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  chipBadgeText: { color: Kairon.textMuted, fontSize: 12, fontWeight: '700' },

  secaoGap: { marginTop: 22 },
  secaoTitle: {
    color: Kairon.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 8,
    marginBottom: 8,
  },
  // "Hoje" ganha destaque pela cor (branco), mantendo o mesmo tamanho.
  secaoTitleHoje: { color: Kairon.text },

  group: {
    marginHorizontal: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },

  vazio: { marginHorizontal: 16, paddingHorizontal: 4, paddingVertical: 24, alignItems: 'center' },
  vazioText: { color: Kairon.textMuted, fontSize: 14, textAlign: 'center' },

  semAcesso: { flex: 1, padding: 16, gap: 12, justifyContent: 'center', alignItems: 'center' },
  semAcessoText: { color: Kairon.textMuted, fontSize: 15, textAlign: 'center' },
});
