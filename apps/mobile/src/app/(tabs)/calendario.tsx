import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { useQuery } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { calendarioApi } from '@kairon/core/api/calendario.api';
import { tarefasApi } from '@kairon/core/api/tarefas.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { useAuth } from '@/auth/AuthContext';
import { NovoItemModal } from '@/components/NovoItemModal';
import {
  Kairon,
  PRIORIDADE_CONFIG,
  STATUS_CONFIG,
  STATUS_ORDER,
  type TarefaPrioridade,
} from '@/constants/kairon';
import {
  isoToLocalDay,
  localISO,
  MONTHS_LONG,
  timeHM,
  WEEKDAYS_LONG,
  WEEKDAYS_TITLE,
} from '@/lib/dates';
import type { Evento, Tarefa } from '@/types/models';

type Segmento = 'tarefas' | 'eventos';
type Pessoa = { id: string; full_name?: string; email?: string; role?: string };

const WEEKS_BEFORE = 12;
const WEEKS_AFTER = 24;

// Altura aproximada da UITabBar nativa (iOS). O FAB flutua acima dela com folga.
const TAB_BAR_HEIGHT = 50;

type DiaInfo = { iso: string; dayNum: number; weekday: number };

/**
 * Gera semanas (segunda -> domingo) ao redor de hoje. Cada semana e uma "pagina"
 * do calendario: a tira mostra 7 dias por vez e arrastar troca de semana.
 */
function buildWeeks(): { weeks: DiaInfo[][]; currentWeekIndex: number; hojeIso: string } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const offsetToMonday = (hoje.getDay() + 6) % 7; // dias desde a ultima segunda
  const monday = new Date(hoje);
  monday.setDate(hoje.getDate() - offsetToMonday);

  const weeks: DiaInfo[][] = [];
  for (let w = -WEEKS_BEFORE; w <= WEEKS_AFTER; w++) {
    const week: DiaInfo[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + w * 7 + d);
      week.push({ iso: localISO(date), dayNum: date.getDate(), weekday: date.getDay() });
    }
    weeks.push(week);
  }
  return { weeks, currentWeekIndex: WEEKS_BEFORE, hojeIso: localISO(hoje) };
}

export default function CalendarioScreen() {
  const { user } = useAuth();

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { weeks, currentWeekIndex, hojeIso } = useMemo(buildWeeks, []);
  const [selectedIso, setSelectedIso] = useState(hojeIso);
  const [segmento, setSegmento] = useState<Segmento>('tarefas');
  const [novoVisible, setNovoVisible] = useState(false);
  const [pessoaId, setPessoaId] = useState<string | null>(null);

  const tarefasQuery = useQuery({ queryKey: queryKeys.tarefas.all, queryFn: tarefasApi.list });
  const eventosQuery = useQuery({ queryKey: queryKeys.calendario.all, queryFn: calendarioApi.list });
  const pessoasQuery = useQuery({ queryKey: queryKeys.calendario.people, queryFn: calendarioApi.listPeople });

  const todasTarefas: Tarefa[] = tarefasQuery.data ?? [];
  const todosEventos: Evento[] = eventosQuery.data ?? [];
  const pessoas: Pessoa[] = pessoasQuery.data ?? [];

  const tarefasDoDia = useMemo(
    () =>
      todasTarefas.filter(
        (t) => t.prazo === selectedIso && (pessoaId ? t.responsavel_id === pessoaId : true)
      ),
    [todasTarefas, selectedIso, pessoaId]
  );
  const eventosDoDia = useMemo(
    () =>
      todosEventos
        .filter(
          (e) =>
            isoToLocalDay(e.start_at) === selectedIso &&
            (pessoaId ? e.assignee_id === pessoaId : true)
        )
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [todosEventos, selectedIso, pessoaId]
  );

  const selecionada = useMemo(() => {
    const [y, m, d] = selectedIso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedIso]);

  const refreshing = tarefasQuery.isFetching || eventosQuery.isFetching;
  function onRefresh() {
    tarefasQuery.refetch();
    eventosQuery.refetch();
  }

  const secoes = useMemo(() => {
    if (segmento === 'eventos') {
      return eventosDoDia.length
        ? [{ title: null, color: null, data: eventosDoDia as (Tarefa | Evento)[] }]
        : [];
    }
    return STATUS_ORDER.map((status) => ({
      title: STATUS_CONFIG[status].label as string | null,
      color: STATUS_CONFIG[status].color as string | null,
      data: tarefasDoDia.filter((t) => t.status === status) as (Tarefa | Evento)[],
    })).filter((s) => s.data.length > 0);
  }, [segmento, tarefasDoDia, eventosDoDia]);

  const header = (
    <View>
      {/* Cabecalho: titulo (dia da semana) + data como subtitulo, e filtro a direita */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.weekdayBig}>{WEEKDAYS_LONG[selecionada.getDay()]}</Text>
            <View style={styles.headerDot} />
          </View>
          <Text style={styles.dateSub}>
            {selecionada.getDate()} de {MONTHS_LONG[selecionada.getMonth()]}{' '}
            {selecionada.getFullYear()}
          </Text>
        </View>

        <GlassView style={styles.filtroGlass} glassEffectStyle="regular" isInteractive>
          <Host style={styles.filtroHost}>
            <Menu
              label={
                <UIImage
                  systemName="line.3.horizontal.decrease"
                  size={20}
                  color={pessoaId ? Kairon.primary : Kairon.text}
                />
              }>
              <UIButton
                systemImage={pessoaId === null ? 'checkmark' : undefined}
                onPress={() => setPessoaId(null)}
                label="Todos"
              />
              {pessoas.map((p) => (
                <UIButton
                  key={p.id}
                  systemImage={pessoaId === p.id ? 'checkmark' : undefined}
                  onPress={() => setPessoaId(p.id)}
                  label={p.full_name || p.email || 'Sem nome'}
                />
              ))}
            </Menu>
          </Host>
        </GlassView>
      </View>

      {/* Tira de dias paginada por semana (7 dias por vez; arrastar = +/- 1 semana) */}
      <FlatList
        horizontal
        pagingEnabled
        data={weeks}
        keyExtractor={(week) => week[0].iso}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={currentWeekIndex}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item: week }) => (
          <View style={[styles.week, { width }]}>
            {week.map((dia) => {
              const selecionado = dia.iso === selectedIso;
              const ehHoje = dia.iso === hojeIso;
              const apagado = !selecionado && !ehHoje;
              return (
                <Pressable
                  key={dia.iso}
                  onPress={() => setSelectedIso(dia.iso)}
                  style={[styles.diaItem, apagado && styles.diaItemDim]}>
                  <Text style={[styles.diaWeekday, selecionado && styles.diaWeekdaySel]}>
                    {WEEKDAYS_TITLE[dia.weekday]}
                  </Text>
                  <View
                    style={[
                      styles.diaNumBox,
                      selecionado && (ehHoje ? styles.diaNumBoxHoje : styles.diaNumBoxSel),
                    ]}>
                    <Text
                      style={[
                        styles.diaNum,
                        ehHoje && !selecionado && styles.diaNumHoje,
                        selecionado && styles.diaNumSel,
                      ]}>
                      {dia.dayNum}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      />

      {/* Segmented control com contadores */}
      <View style={styles.segmented}>
        <Segment
          label="Tarefas"
          count={tarefasDoDia.length}
          active={segmento === 'tarefas'}
          onPress={() => setSegmento('tarefas')}
        />
        <Segment
          label="Eventos"
          count={eventosDoDia.length}
          active={segmento === 'eventos'}
          onPress={() => setSegmento('eventos')}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SectionList
        sections={secoes}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Kairon.primary} />
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={styles.secHeader}>
              <View style={[styles.secDot, { backgroundColor: section.color ?? Kairon.textMuted }]} />
              <Text style={[styles.secTitle, { color: section.color ?? Kairon.textMuted }]}>
                {section.title}
              </Text>
              <Text style={styles.secCount}>{section.data.length}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          segmento === 'tarefas' ? (
            <TarefaRow tarefa={item as Tarefa} />
          ) : (
            <EventoRow evento={item as Evento} />
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {segmento === 'tarefas' ? 'Nenhuma tarefa neste dia' : 'Nenhum evento neste dia'}
            </Text>
            <Text style={styles.emptySub}>Escolha outro dia ou puxe para atualizar.</Text>
          </View>
        }
      />

      {/* FAB acima da tab bar (lado direito), com folga generosa */}
      <Pressable
        onPress={() => setNovoVisible(true)}
        style={[styles.fab, { bottom: insets.bottom + TAB_BAR_HEIGHT + 32 }]}>
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>

      <NovoItemModal
        visible={novoVisible}
        onClose={() => setNovoVisible(false)}
        dateIso={selectedIso}
        defaultTipo={segmento === 'eventos' ? 'evento' : 'tarefa'}
        userId={user?.id}
      />
    </SafeAreaView>
  );
}

function Segment({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.segment}>
      <View style={styles.segmentInner}>
        <View style={styles.segmentRow}>
          <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
          <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
            <Text style={[styles.segmentBadgeText, active && styles.segmentBadgeTextActive]}>
              {count}
            </Text>
          </View>
        </View>
        <View style={[styles.underline, active && styles.underlineActive]} />
      </View>
    </Pressable>
  );
}

function TarefaRow({ tarefa }: { tarefa: Tarefa }) {
  const concluida = tarefa.status === 'concluida';
  const prio = PRIORIDADE_CONFIG[tarefa.prioridade as TarefaPrioridade] ?? PRIORIDADE_CONFIG.media;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: concluida ? Kairon.textMuted : prio.color }]} />
      <View style={styles.flex}>
        <Text
          style={[styles.rowTitle, concluida && styles.rowTitleConcluida]}
          numberOfLines={1}>
          {tarefa.titulo}
        </Text>
        {tarefa.clientes?.nome ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {tarefa.clientes.nome}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowTrailing, { color: concluida ? Kairon.textMuted : prio.color }]}>
        {prio.label}
      </Text>
    </View>
  );
}

function EventoRow({ evento }: { evento: Evento }) {
  const hora = evento.all_day ? 'Dia todo' : timeHM(evento.start_at);
  const sub = [evento.location, evento.assignee?.full_name, evento.squad?.nome]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.row}>
      <View style={styles.horaCol}>
        <Text style={styles.horaText}>{hora}</Text>
        {!evento.all_day && evento.end_at ? (
          <Text style={styles.horaFim}>{timeHM(evento.end_at)}</Text>
        ) : null}
      </View>
      <View style={[styles.eventoBar]} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {evento.title}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Kairon.bg },
  flex: { flex: 1 },
  content: { paddingBottom: 140 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerLeft: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekdayBig: { color: Kairon.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  headerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Kairon.primary, marginTop: 6 },
  dateSub: { color: Kairon.textMuted, fontSize: 14, fontWeight: '600', marginTop: 4 },
  filtroGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filtroHost: { width: 44, height: 44 },

  week: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  diaItem: { width: 42, alignItems: 'center', gap: 7 },
  diaItemDim: { opacity: 0.4 },
  diaWeekday: { color: Kairon.textMuted, fontSize: 12, fontWeight: '600' },
  diaWeekdaySel: { color: Kairon.text },
  diaNumBox: { width: 36, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  diaNumBoxHoje: { backgroundColor: Kairon.primary },
  diaNumBoxSel: { backgroundColor: `${Kairon.primary}40` },
  diaNum: { color: Kairon.text, fontSize: 17, fontWeight: '700' },
  diaNumHoje: { color: Kairon.primary },
  diaNumSel: { color: '#fff' },

  segmented: {
    flexDirection: 'row',
    marginTop: 22,
    marginBottom: 12,
  },
  segment: { flex: 1, alignItems: 'center' },
  segmentInner: { alignItems: 'center', gap: 8 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  underline: { height: 2, borderRadius: 1, alignSelf: 'stretch', backgroundColor: 'transparent' },
  underlineActive: { backgroundColor: Kairon.primary },
  segmentLabel: { color: Kairon.textMuted, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  segmentLabelActive: { color: Kairon.text },
  segmentBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  segmentBadgeActive: { backgroundColor: Kairon.primary },
  segmentBadgeText: { color: Kairon.textMuted, fontSize: 12, fontWeight: '700' },
  segmentBadgeTextActive: { color: '#fff' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Kairon.cardBorder,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { color: Kairon.text, fontSize: 15, fontWeight: '600' },
  rowTitleConcluida: {
    color: Kairon.textMuted,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  rowSub: { color: Kairon.textMuted, fontSize: 12, marginTop: 2 },
  rowTrailing: { fontSize: 12, fontWeight: '600' },

  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  secDot: { width: 7, height: 7, borderRadius: 4 },
  secTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  secCount: { color: Kairon.textMuted, fontSize: 12, fontWeight: '700' },

  horaCol: { width: 48, alignItems: 'flex-start' },
  horaText: { color: Kairon.text, fontSize: 13, fontWeight: '700' },
  horaFim: { color: Kairon.textMuted, fontSize: 11, marginTop: 2 },
  eventoBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: Kairon.primary },

  empty: { padding: 40, alignItems: 'center', gap: 4 },
  emptyTitle: { color: Kairon.text, fontSize: 14, fontWeight: '600' },
  emptySub: { color: Kairon.textMuted, fontSize: 12 },

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
  fabPlus: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },
});
