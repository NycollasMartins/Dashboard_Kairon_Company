import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { useQuery } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { calendarioApi } from '@kairon/core/api/calendario.api';
import { tarefasApi } from '@kairon/core/api/tarefas.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { useAuth } from '@/auth/AuthContext';
import { EditarItemModal, type ItemEdicao } from '@/components/EditarItemModal';
import { MonthCalendar, type DiaMarker } from '@/components/MonthCalendar';
import { NovoItemModal } from '@/components/NovoItemModal';
import {
  Kairon,
  PRIORIDADE_CONFIG,
  STATUS_CONFIG,
  type TarefaPrioridade,
  type TarefaStatus,
} from '@/constants/kairon';
import { isoToLocalDay, localISO, timeHM } from '@/lib/dates';
import type { Evento, Tarefa } from '@/types/models';

type Pessoa = { id: string; full_name?: string; email?: string; role?: string };

// Ordem das secoes de tarefas na Agenda: revisao -> em andamento -> pendente -> concluida (no fim).
const TAREFA_SECAO_ORDER: TarefaStatus[] = ['revisao', 'em_andamento', 'pendente', 'concluida'];

// Altura aproximada da UITabBar nativa (iOS). O FAB flutua acima dela com folga.
const TAB_BAR_HEIGHT = 50;

const HOJE_ISO = localISO(new Date());

export default function AgendaScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [selectedIso, setSelectedIso] = useState(HOJE_ISO);
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
  // Agrupa as tarefas do dia por status, na ordem de exibicao da Agenda.
  const tarefasPorStatus = useMemo(
    () =>
      TAREFA_SECAO_ORDER.map((status) => ({
        status,
        tarefas: tarefasDoDia.filter((t) => t.status === status),
      })).filter((s) => s.tarefas.length > 0),
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

  // Rotulo do filtro ativo, mostrado como subtitulo (Todos / seu nome / nome da pessoa).
  const filtroLabel = useMemo(() => {
    if (!pessoaId) return 'Todos';
    if (pessoaId === user?.id) return 'Apenas você';
    const p = pessoas.find((x) => x.id === pessoaId);
    return p?.full_name || p?.email || 'Pessoa selecionada';
  }, [pessoaId, pessoas, user?.id]);

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
        {/* Navigation Title + filtro de pessoa */}
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.bigTitle}>Agenda</Text>
            <View style={styles.filtroSubRow}>
              <View style={[styles.filtroSubDot, pessoaId && styles.filtroSubDotActive]} />
              <Text style={styles.filtroSub}>{filtroLabel}</Text>
            </View>
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

        <MonthCalendar
          selectedIso={selectedIso}
          hojeIso={HOJE_ISO}
          markers={markers}
          onSelectDay={setSelectedIso}
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
                  {tarefasPorStatus.map(({ status, tarefas }, i) => (
                    <View key={status} style={i > 0 && styles.statusSecaoGap}>
                      <StatusHeader status={status} count={tarefas.length} />
                      {tarefas.map((t) => (
                        <TarefaRow
                          key={t.id}
                          tarefa={t}
                          onPress={() => setEditando({ kind: 'tarefa', data: t })}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* FAB logo acima da tab bar (lado direito) */}
      <Pressable
        onPress={() => setNovoVisible(true)}
        style={[styles.fab, { bottom: insets.bottom + 24}]}>
        <SymbolView name="plus" size={28} weight="semibold" tintColor="#fff" />
      </Pressable>

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

function StatusHeader({ status, count }: { status: TarefaStatus; count: number }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendente;
  return (
    <View style={styles.statusHeader}>
      <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.statusTitle, { color: cfg.color }]}>{cfg.label}</Text>
      <Text style={styles.statusCount}>{count}</Text>
    </View>
  );
}

function TarefaRow({ tarefa, onPress }: { tarefa: Tarefa; onPress: () => void }) {
  const concluida = tarefa.status === 'concluida';
  const prio = PRIORIDADE_CONFIG[tarefa.prioridade as TarefaPrioridade] ?? PRIORIDADE_CONFIG.media;
  const urgente = tarefa.prioridade === 'urgente';
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
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  bigTitle: { color: Kairon.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  filtroSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  filtroSubDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Kairon.textMuted },
  filtroSubDotActive: { backgroundColor: Kairon.primary },
  filtroSub: { color: Kairon.textMuted, fontSize: 14, fontWeight: '600' },
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
  secaoLabel: { color: Kairon.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  secaoBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  secaoBadgeText: { color: Kairon.textMuted, fontSize: 12, fontWeight: '700' },

  statusSecaoGap: { marginTop: 24 },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusCount: { color: Kairon.textMuted, fontSize: 10, fontWeight: '700' },

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
