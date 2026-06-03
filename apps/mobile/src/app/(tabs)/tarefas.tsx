import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tarefasApi } from '@kairon/core/api/tarefas.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { useAuth } from '@/auth/AuthContext';
import {
  Kairon,
  PRIORIDADE_CONFIG,
  STATUS_CONFIG,
  STATUS_ORDER,
  type TarefaPrioridade,
} from '@/constants/kairon';
import { isAtrasada } from '@/lib/dates';
import type { Tarefa } from '@/types/models';

type Secao = { title: string; color: string; data: Tarefa[] };

export default function TarefasScreen() {
  const { user } = useAuth();
  const tarefasQuery = useQuery({ queryKey: queryKeys.tarefas.all, queryFn: tarefasApi.list });

  const secoes: Secao[] = useMemo(() => {
    const todas: Tarefa[] = tarefasQuery.data ?? [];
    const minhas = todas.filter((t) => t.responsavel_id === user?.id);
    return STATUS_ORDER.map((status) => ({
      title: STATUS_CONFIG[status].label,
      color: STATUS_CONFIG[status].color,
      data: minhas.filter((t) => t.status === status),
    })).filter((s) => s.data.length > 0);
  }, [tarefasQuery.data, user?.id]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Minhas Tarefas</Text>
      <SectionList
        sections={secoes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={tarefasQuery.isFetching}
            onRefresh={tarefasQuery.refetch}
            tintColor={Kairon.primary}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View style={[styles.dot, { backgroundColor: section.color }]} />
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const prio = PRIORIDADE_CONFIG[item.prioridade as TarefaPrioridade] ?? PRIORIDADE_CONFIG.media;
          const atrasada = isAtrasada(item.prazo) && item.status !== 'concluida';
          return (
            <View style={styles.card}>
              <Text style={styles.titulo} numberOfLines={2}>
                {item.titulo}
              </Text>
              <View style={styles.metaRow}>
                <View style={[styles.prioBadge, { backgroundColor: `${prio.color}22` }]}>
                  <Text style={[styles.prioText, { color: prio.color }]}>{prio.label}</Text>
                </View>
                {item.clientes?.nome ? (
                  <Text style={styles.cliente} numberOfLines={1}>
                    {item.clientes.nome}
                  </Text>
                ) : null}
                {item.prazo ? (
                  <Text style={[styles.prazo, atrasada && { color: Kairon.red }]}>
                    {atrasada ? 'Atrasada · ' : ''}
                    {item.prazo}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhuma tarefa atribuída a você</Text>
            <Text style={styles.emptySub}>Puxe para atualizar.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Kairon.bg },
  header: { color: Kairon.text, fontSize: 24, fontWeight: '800', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { color: Kairon.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { color: Kairon.textMuted, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: Kairon.card,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  titulo: { color: Kairon.text, fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  prioBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  prioText: { fontSize: 12, fontWeight: '700' },
  cliente: { color: Kairon.textMuted, fontSize: 12, flexShrink: 1 },
  prazo: { color: Kairon.textMuted, fontSize: 12, marginLeft: 'auto' },
  empty: { padding: 40, alignItems: 'center', gap: 4 },
  emptyTitle: { color: Kairon.text, fontSize: 14, fontWeight: '600' },
  emptySub: { color: Kairon.textMuted, fontSize: 12 },
});
