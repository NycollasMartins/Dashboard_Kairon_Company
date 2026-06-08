import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { useQuery } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calendarioApi } from '@kairon/core/api/calendario.api';
import { tarefasApi } from '@kairon/core/api/tarefas.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { useAuth } from '@/auth/AuthContext';
import { EditarItemModal, type ItemEdicao } from '@/components/EditarItemModal';
import { MonthCalendar, type DiaMarker, type MesView } from '@/components/MonthCalendar';
import { NovoItemModal } from '@/components/NovoItemModal';
import {
  Kairon,
  PRIORIDADE_CONFIG,
  STATUS_CONFIG,
  type TarefaPrioridade,
  type TarefaStatus,
} from '@/constants/kairon';
import { isoToLocalDay, localISO, MONTHS_LONG, timeHM } from '@/lib/dates';
import type { Evento, Tarefa } from '@/types/models';

type Pessoa = { id: string; full_name?: string; email?: string; role?: string };

// Ordem das secoes de tarefas na Agenda: revisao -> em andamento -> pendente -> concluida (no fim).
const TAREFA_SECAO_ORDER: TarefaStatus[] = ['revisao', 'em_andamento', 'pendente', 'concluida'];

// Abreviacao curta de cada status, exibida no card da tarefa.
const STATUS_ABBR: Record<TarefaStatus, string> = {
  revisao: 'Revisão',
  em_andamento: 'Andam.',
  pendente: 'Pend.',
  concluida: 'Concl.',
};

// Altura aproximada da UITabBar nativa (iOS). O FAB flutua acima dela com folga.
const TAB_BAR_HEIGHT = 50;

const HOJE_ISO = localISO(new Date());

export default function AgendaScreen() {
  const { user } = useAuth();
  const { height: screenH } = useWindowDimensions();

  const [selectedIso, setSelectedIso] = useState(HOJE_ISO);
  const [calView, setCalView] = useState<MesView>(() => {
    const [yy, mm] = HOJE_ISO.split('-').map(Number);
    return { year: yy, month: mm - 1 };
  });
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [novoVisible, setNovoVisible] = useState(false);
  const [editando, setEditando] = useState<ItemEdicao>(null);

  const tarefasQuery = useQuery({ queryKey: queryKeys.tarefas.all, queryFn: tarefasApi.list });
  const eventosQuery = useQuery({ queryKey: queryKeys.calendario.all, queryFn: calendarioApi.list });
  const pessoasQuery = useQuery({ queryKey: queryKeys.calendario.people, queryFn: calendarioApi.listPeople });

  const todasTarefas: Tarefa[] = tarefasQuery.data ?? [];
  const todosEventos: Evento[] = eventosQuery.data ?? [];
  const pessoas: Pessoa[] = pessoasQuery.data ?? [];

  // Mapa iso -> { tarefa, evento } para as bolinhas do calendario (respeita o filtro de pessoa).
  const markers = useMemo(() => {
    const map = new Map<string, DiaMarker>();
    const marca = (iso: string, chave: keyof DiaMarker) => {
      const atual = map.get(iso) ?? { tarefa: false, evento: false };
      atual[chave] = true;
      map.set(iso, atual);
    };
    for (const t of todasTarefas) {
      if (t.prazo && (!pessoaId || t.responsavel_id === pessoaId)) marca(t.prazo, 'tarefa');
    }
    for (const e of todosEventos) {
      if (!pessoaId || e.assignee_id === pessoaId) marca(isoToLocalDay(e.start_at), 'evento');
    }
    return map;
  }, [todasTarefas, todosEventos, pessoaId]);

  const tarefasDoDia = useMemo(
    () =>
      todasTarefas.filter(
        (t) => t.prazo === selectedIso && (pessoaId ? t.responsavel_id === pessoaId : true)
      ),
    [todasTarefas, selectedIso, pessoaId]
  );
  // Lista unica de tarefas do dia, ordenada por status (revisao -> andamento -> pendente -> concluida).
  const tarefasOrdenadas = useMemo(
    () =>
      [...tarefasDoDia].sort(
        (a, b) =>
          TAREFA_SECAO_ORDER.indexOf(a.status as TarefaStatus) -
          TAREFA_SECAO_ORDER.indexOf(b.status as TarefaStatus)
      ),
    [tarefasDoDia]
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

  const refreshing = tarefasQuery.isFetching || eventosQuery.isFetching;
  function onRefresh() {
    tarefasQuery.refetch();
    eventosQuery.refetch();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Kairon.primary} />
        }>
        {/* Titulo do mes (centralizado) + filtro de pessoa + adicionar demanda */}
        <View style={styles.headerRow}>
          <View style={styles.headerSide} />
          <Text style={styles.monthTitle}>
            {MONTHS_LONG[calView.month]} {calView.year}
          </Text>
          <View style={styles.headerActions}>
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
            <Pressable onPress={() => setNovoVisible(true)} hitSlop={8}>
              <GlassView style={styles.filtroGlass} glassEffectStyle="regular" isInteractive>
                <Host matchContents>
                  <UIImage systemName="plus" size={20} color={Kairon.text} />
                </Host>
              </GlassView>
            </Pressable>
          </View>
        </View>

        {/* Espacamento de 3% entre a navigation bar e o calendario. */}
        <View style={{ height: screenH * 0.03 }} />

        <MonthCalendar
          selectedIso={selectedIso}
          hojeIso={HOJE_ISO}
          markers={markers}
          onSelectDay={setSelectedIso}
          view={calView}
          onViewChange={setCalView}
        />

        <View style={styles.divider} />

        {/* Lista unificada: eventos primeiro, depois tarefas */}
        <Animated.View key={selectedIso} entering={FadeIn.duration(220)}>
          {eventosDoDia.length === 0 && tarefasDoDia.length === 0 ? (
            <EmptyRow text="Nada agendado neste dia" />
          ) : (
            <>
              {eventosDoDia.length > 0 ? (
                <View>
                  <SecaoHeader label="Eventos" count={eventosDoDia.length} />
                  {eventosDoDia.map((e) => (
                    <EventoRow
                      key={e.id}
                      evento={e}
                      onPress={() => setEditando({ kind: 'evento', data: e })}
                    />
                  ))}
                </View>
              ) : null}

              {tarefasDoDia.length > 0 ? (
                <View style={eventosDoDia.length > 0 && styles.secaoGap}>
                  <SecaoHeader label="Tarefas" count={tarefasDoDia.length} />
                  {tarefasOrdenadas.map((t) => (
                    <TarefaRow
                      key={t.id}
                      tarefa={t}
                      onPress={() => setEditando({ kind: 'tarefa', data: t })}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </Animated.View>
      </ScrollView>

      <NovoItemModal
        visible={novoVisible}
        onClose={() => setNovoVisible(false)}
        dateIso={selectedIso}
        defaultTipo="evento"
        userId={user?.id}
      />

      <EditarItemModal item={editando} onClose={() => setEditando(null)} />
    </SafeAreaView>
  );
}

function SecaoHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.secaoHeader}>
      <Text style={styles.secaoLabel}>{label}</Text>
      <View style={styles.secaoBadge}>
        <Text style={styles.secaoBadgeText}>{count}</Text>
      </View>
    </View>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function TarefaRow({ tarefa, onPress }: { tarefa: Tarefa; onPress: () => void }) {
  const concluida = tarefa.status === 'concluida';
  const prio = PRIORIDADE_CONFIG[tarefa.prioridade as TarefaPrioridade] ?? PRIORIDADE_CONFIG.media;
  const urgente = tarefa.prioridade === 'urgente';
  const statusCfg = STATUS_CONFIG[tarefa.status as TarefaStatus] ?? STATUS_CONFIG.pendente;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.dot, { backgroundColor: Kairon.red }]} />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, concluida && styles.rowTitleConcluida]} numberOfLines={1}>
          {tarefa.titulo}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          <Text style={[styles.prioSub, urgente && !concluida && styles.prioSubUrgente]}>
            {prio.label}
          </Text>
          {tarefa.clientes?.nome ? ` · ${tarefa.clientes.nome}` : ''}
        </Text>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
          <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
            {STATUS_ABBR[tarefa.status as TarefaStatus] ?? statusCfg.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EventoRow({ evento, onPress }: { evento: Evento; onPress: () => void }) {
  const hora = evento.all_day ? 'Dia todo' : timeHM(evento.start_at);
  const sub = [evento.location, evento.assignee?.full_name, evento.squad?.nome]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.horaCol}>
        <Text style={styles.horaText}>{hora}</Text>
        {!evento.all_day && evento.end_at ? (
          <Text style={styles.horaFim}>{timeHM(evento.end_at)}</Text>
        ) : null}
      </View>
      <View style={styles.eventoBar} />
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Kairon.bg },
  flex: { flex: 1 },
  content: { paddingBottom: 160 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSide: { width: 96 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
    color: Kairon.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    textTransform: 'capitalize',
  },
  filtroGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filtroHost: { width: 44, height: 44 },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Kairon.cardBorder,
    marginHorizontal: 16,
    marginTop: 12,
  },
  secaoGap: { marginTop: 28 },
  secaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 4,
  },
  secaoLabel: { color: Kairon.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  secaoBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  secaoBadgeText: { color: Kairon.textMuted, fontSize: 12, fontWeight: '700' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

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
  prioSub: { color: Kairon.textMuted, fontWeight: '700' },
  prioSubUrgente: { color: Kairon.red },

  emptyRow: { paddingHorizontal: 16, paddingVertical: 16 },
  emptyText: { color: Kairon.textMuted, fontSize: 13 },

  horaCol: { width: 48, alignItems: 'flex-start' },
  horaText: { color: Kairon.text, fontSize: 13, fontWeight: '700' },
  horaFim: { color: Kairon.textMuted, fontSize: 11, marginTop: 2 },
  eventoBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: Kairon.blue },

});
