import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { projetosApi } from '@kairon/core/api/projetos.api';
import { tarefasApi } from '@kairon/core/api/tarefas.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { useAuth } from '@/auth/AuthContext';
import { Card, KpiCard, SectionTitle } from '@/components/kairon-ui';
import { Kairon, PRIORIDADE_CONFIG, type TarefaPrioridade } from '@/constants/kairon';
import { getTodayStr, isAtrasada, saudacao } from '@/lib/dates';
import type { Projeto, Tarefa } from '@/types/models';

export default function VisaoGeralScreen() {
  const { user } = useAuth();

  const tarefasQuery = useQuery({ queryKey: queryKeys.tarefas.all, queryFn: tarefasApi.list });
  const projetosQuery = useQuery({ queryKey: queryKeys.projetos.all, queryFn: projetosApi.list });

  const todasTarefas: Tarefa[] = tarefasQuery.data ?? [];
  const projetos: Projeto[] = projetosQuery.data ?? [];

  const m = useMemo(() => {
    const minhas = todasTarefas.filter((t) => t.responsavel_id === user?.id);
    const hoje = getTodayStr();
    const tarefasHoje = minhas.filter((t) => t.prazo === hoje && t.status !== 'concluida');
    const pendentes = minhas.filter((t) => t.status !== 'concluida');
    const concluidas = minhas.filter((t) => t.status === 'concluida');
    const emAndamento = minhas.filter((t) => t.status === 'em_andamento');
    const atrasadas = minhas.filter((t) => isAtrasada(t.prazo) && t.status !== 'concluida');
    const total = minhas.length;
    const pct = total > 0 ? Math.round((concluidas.length / total) * 100) : 0;
    return { tarefasHoje, pendentes, concluidas, emAndamento, atrasadas, pct };
  }, [todasTarefas, user?.id]);

  const projetosAtivos = projetos.filter((p) => p.status === 'ativo');
  const primeiroNome = user?.full_name?.split(' ')[0] || 'você';
  const refreshing = tarefasQuery.isFetching || projetosQuery.isFetching;

  function onRefresh() {
    tarefasQuery.refetch();
    projetosQuery.refetch();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Kairon.primary} />
        }>
        <View>
          <Text style={styles.greeting}>
            {saudacao()}, <Text style={{ color: Kairon.primary }}>{primeiroNome}!</Text>
          </Text>
          <Text style={styles.greetingSub}>
            {m.tarefasHoje.length > 0
              ? `${m.tarefasHoje.length} tarefa${m.tarefasHoje.length > 1 ? 's' : ''} para hoje${
                  m.atrasadas.length > 0 ? ` e ${m.atrasadas.length} em atraso` : ''
                }.`
              : m.pendentes.length > 0
                ? `${m.pendentes.length} pendente${m.pendentes.length > 1 ? 's' : ''} no escopo.`
                : 'Tudo em dia. 🎉'}
          </Text>
        </View>

        {m.atrasadas.length > 0 && (
          <View style={styles.alerta}>
            <Text style={styles.alertaText}>
              ⚠️ {m.atrasadas.length} tarefa{m.atrasadas.length > 1 ? 's' : ''} em atraso
            </Text>
          </View>
        )}

        <View>
          <SectionTitle>Performance</SectionTitle>
          <View style={styles.kpiGrid}>
            <KpiCard value={`${m.pct}%`} label="Taxa de Conclusão" sub={`${m.concluidas.length} de ${m.concluidas.length + m.pendentes.length}`} color={Kairon.emerald} />
            <KpiCard value={m.emAndamento.length} label="Em Andamento" sub="ativas agora" color={Kairon.blue} />
            <KpiCard value={m.pendentes.length} label="Pendentes" sub="aguardando" color={Kairon.red} />
            <KpiCard value={m.concluidas.length} label="Concluídas" sub="finalizadas" color={Kairon.yellow} />
          </View>
        </View>

        <View>
          <SectionTitle>Tarefas para Hoje</SectionTitle>
          <Card style={{ padding: 0 }}>
            {m.tarefasHoje.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Sem tarefas para hoje</Text>
                <Text style={styles.emptySub}>Aproveite ou antecipe demandas futuras.</Text>
              </View>
            ) : (
              m.tarefasHoje.map((t, i) => {
                const prio = PRIORIDADE_CONFIG[t.prioridade as TarefaPrioridade] ?? PRIORIDADE_CONFIG.media;
                return (
                  <View key={t.id} style={[styles.row, i > 0 && styles.rowBorder]}>
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
                  </View>
                );
              })
            )}
          </Card>
        </View>

        <View>
          <SectionTitle>Projetos Ativos</SectionTitle>
          <Card style={{ padding: 0 }}>
            {projetosAtivos.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nenhum projeto ativo</Text>
                <Text style={styles.emptySub}>Projetos ativos aparecerão aqui.</Text>
              </View>
            ) : (
              projetosAtivos.slice(0, 6).map((p, i) => {
                const tarefasDoProjeto = todasTarefas.filter((t) => t.projeto_id === p.id);
                const concluidas = tarefasDoProjeto.filter((t) => t.status === 'concluida').length;
                const pct = tarefasDoProjeto.length > 0 ? Math.round((concluidas / tarefasDoProjeto.length) * 100) : 0;
                return (
                  <View key={p.id} style={[styles.projeto, i > 0 && styles.rowBorder]}>
                    <View style={styles.projetoHead}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {p.nome}
                      </Text>
                      <Text style={styles.rowSub}>{pct}%</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Kairon.bg },
  flex: { flex: 1 },
  content: { padding: 16, gap: 24, paddingBottom: 40 },
  greeting: { color: Kairon.text, fontSize: 26, fontWeight: '800' },
  greetingSub: { color: Kairon.textMuted, fontSize: 14, marginTop: 6 },
  alerta: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertaText: { color: Kairon.red, fontSize: 14, fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Kairon.cardBorder },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { color: Kairon.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: Kairon.textMuted, fontSize: 12, marginTop: 2 },
  prio: { fontSize: 12, fontWeight: '600' },
  empty: { padding: 28, alignItems: 'center', gap: 4 },
  emptyTitle: { color: Kairon.text, fontSize: 14, fontWeight: '600' },
  emptySub: { color: Kairon.textMuted, fontSize: 12 },
  projeto: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  projetoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: Kairon.primary, borderRadius: 2 },
});
