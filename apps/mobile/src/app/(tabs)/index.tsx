import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { Host, Image as UIImage } from '@expo/ui/swift-ui';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calendarioApi } from '@kairon/core/api/calendario.api';
import { tarefasApi } from '@kairon/core/api/tarefas.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { useAuth } from '@/auth/AuthContext';
import { FinanceiroSheet } from '@/components/FinanceiroSheet';
import { PerfilSheet } from '@/components/PerfilSheet';
import { Kairon, PRIORIDADE_CONFIG, type TarefaPrioridade } from '@/constants/kairon';
import { isAtrasada, isoToLocalDay, localISO, timeHM, WEEKDAYS_LONG } from '@/lib/dates';
import type { Evento, Tarefa } from '@/types/models';

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const HOJE = new Date();
const HOJE_ISO = localISO(HOJE);

// Folga de 10% da altura da tela entre o resumo e a programacao do dia.
const ESPACO_RESUMO = Dimensions.get('window').height * 0.1;

function saudacaoHoje(): string {
  const h = HOJE.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HojeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';
  const [perfilVisible, setPerfilVisible] = useState(false);
  const [financeiroVisible, setFinanceiroVisible] = useState(false);

  const tarefasQuery = useQuery({ queryKey: queryKeys.tarefas.all, queryFn: tarefasApi.list });
  const eventosQuery = useQuery({ queryKey: queryKeys.calendario.all, queryFn: calendarioApi.list });

  const todasTarefas: Tarefa[] = tarefasQuery.data ?? [];
  const todosEventos: Evento[] = eventosQuery.data ?? [];

  // Tarefas e eventos do usuario para HOJE (visao pessoal: "o que eu tenho hoje").
  const tarefasHoje = useMemo(
    () =>
      todasTarefas.filter(
        (t) => t.responsavel_id === user?.id && t.prazo === HOJE_ISO && t.status !== 'concluida'
      ),
    [todasTarefas, user?.id]
  );

  const atrasadas = useMemo(
    () =>
      todasTarefas.filter(
        (t) => t.responsavel_id === user?.id && isAtrasada(t.prazo) && t.status !== 'concluida'
      ),
    [todasTarefas, user?.id]
  );

  const eventosHoje = useMemo(
    () =>
      todosEventos
        .filter((e) => isoToLocalDay(e.start_at) === HOJE_ISO)
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [todosEventos]
  );

  const primeiroNome = user?.full_name?.split(' ')[0] || 'você';
  const dia = String(HOJE.getDate()).padStart(2, '0');
  const mesAno = `${MONTHS_SHORT[HOJE.getMonth()]}'${String(HOJE.getFullYear()).slice(-2)}`;
  const diaSemana = WEEKDAYS_LONG[HOJE.getDay()];

  const refreshing = tarefasQuery.isFetching || eventosQuery.isFetching;
  function onRefresh() {
    tarefasQuery.refetch();
    eventosQuery.refetch();
  }

  const nada = eventosHoje.length === 0 && tarefasHoje.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Kairon.primary} />
        }>
        {/* Barra superior: financeiro (esq., admin) e perfil (dir.), em vidro */}
        <View style={styles.topBar}>
          {isAdmin ? (
            <Pressable onPress={() => setFinanceiroVisible(true)} hitSlop={8}>
              <GlassView style={styles.navBtn} glassEffectStyle="regular" isInteractive>
                <Host matchContents>
                  <UIImage systemName="chart.line.uptrend.xyaxis" size={17} color={Kairon.text} />
                </Host>
              </GlassView>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={() => setPerfilVisible(true)} hitSlop={8}>
            <GlassView style={styles.navBtn} glassEffectStyle="regular" isInteractive>
              <Host matchContents>
                <UIImage systemName="person.fill" size={17} color={Kairon.text} />
              </Host>
            </GlassView>
          </Pressable>
        </View>

        {/* Cabecalho com a data em destaque */}
        <View style={styles.dateHeader}>
          <View style={styles.dayWrap}>
            <Text style={styles.dayNum}>{dia}</Text>
            <View style={styles.dayDot} />
          </View>
          <View style={styles.dateRight}>
            <Text style={styles.monthYear}>{mesAno}</Text>
            <Text style={styles.weekday}>{diaSemana}</Text>
          </View>
        </View>

        {/* Resumo escrito do dia */}
        <Text style={styles.summary}>
          <Text style={styles.summaryStrong}>
            {saudacaoHoje()}, {primeiroNome}.
          </Text>{' '}
          {nada ? (
            <>Você não tem nada agendado para hoje. Aproveite ou antecipe demandas futuras.</>
          ) : (
            <>
              Você tem{' '}
              <Text style={styles.summaryStrong}>
                {eventosHoje.length} evento{eventosHoje.length === 1 ? '' : 's'}
              </Text>{' '}
              e{' '}
              <Text style={styles.summaryStrong}>
                {tarefasHoje.length} tarefa{tarefasHoje.length === 1 ? '' : 's'}
              </Text>{' '}
              hoje
              {atrasadas.length > 0 ? (
                <>
                  , além de{' '}
                  <Text style={styles.summaryDanger}>
                    {atrasadas.length} em atraso
                  </Text>
                </>
              ) : null}
              .
            </>
          )}
        </Text>

        <View style={{ height: ESPACO_RESUMO }} />

        {/* Programacao de hoje (eventos + tarefas juntos) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Programação de hoje</Text>
          <View style={styles.card}>
            {nada ? (
              <Empty title="Nada para hoje" sub="Aproveite ou antecipe demandas futuras." />
            ) : (
              <>
                {eventosHoje.map((e, i) => (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push('/agenda')}
                    style={[styles.eventRow, i > 0 && styles.rowBorder]}>
                    <View style={styles.horaCol}>
                      <Text style={styles.horaText}>{e.all_day ? 'Dia' : timeHM(e.start_at)}</Text>
                      {!e.all_day && e.end_at ? (
                        <Text style={styles.horaFim}>{timeHM(e.end_at)}</Text>
                      ) : null}
                    </View>
                    <View style={styles.eventBar} />
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {e.title}
                      </Text>
                      {e.assignee?.full_name || e.location ? (
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {[e.location, e.assignee?.full_name].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
                {tarefasHoje.map((t, i) => {
                  const prio =
                    PRIORIDADE_CONFIG[t.prioridade as TarefaPrioridade] ?? PRIORIDADE_CONFIG.media;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push('/agenda')}
                      style={[
                        styles.row,
                        (i > 0 || eventosHoje.length > 0) && styles.rowBorder,
                      ]}>
                      <View style={[styles.dot, { backgroundColor: prio.color }]} />
                      <View style={styles.flex}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {t.titulo}
                        </Text>
                        {t.clientes?.nome ? (
                          <Text style={styles.rowSub} numberOfLines={1}>
                            {t.clientes.nome}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.prio, { color: prio.color }]}>{prio.label}</Text>
                    </Pressable>
                  );
                })}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <PerfilSheet visible={perfilVisible} onClose={() => setPerfilVisible(false)} />
      <FinanceiroSheet visible={financeiroVisible} onClose={() => setFinanceiroVisible(false)} />
    </SafeAreaView>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Kairon.bg },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 60, gap: 22 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -8 },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  dateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  dayWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  dayNum: { color: Kairon.text, fontSize: 64, fontWeight: '800', letterSpacing: -2, lineHeight: 64 },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Kairon.primary,
    marginLeft: 6,
    marginTop: 10,
  },
  dateRight: { alignItems: 'flex-end', marginTop: 8 },
  monthYear: { color: Kairon.textMuted, fontSize: 16, fontWeight: '700' },
  weekday: { color: Kairon.textMuted, fontSize: 16, fontWeight: '500', textTransform: 'capitalize' },

  summary: { color: Kairon.textMuted, fontSize: 22, fontWeight: '500', lineHeight: 30, marginTop: -4 },
  summaryStrong: { color: Kairon.text, fontWeight: '700' },
  summaryDanger: { color: Kairon.red, fontWeight: '700' },

  section: { gap: 12 },
  sectionTitle: {
    color: Kairon.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: Kairon.card,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Kairon.cardBorder },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { color: Kairon.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: Kairon.textMuted, fontSize: 12, marginTop: 2 },
  prio: { fontSize: 12, fontWeight: '600' },

  horaCol: { width: 44, alignItems: 'flex-start' },
  horaText: { color: Kairon.text, fontSize: 13, fontWeight: '700' },
  horaFim: { color: Kairon.textMuted, fontSize: 11, marginTop: 2 },
  eventBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: Kairon.blue },

  empty: { padding: 28, alignItems: 'center', gap: 4 },
  emptyTitle: { color: Kairon.text, fontSize: 14, fontWeight: '600' },
  emptySub: { color: Kairon.textMuted, fontSize: 12 },
});
