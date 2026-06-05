import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { leadsApi } from '@kairon/core/api/leads.api';
import { usersApi } from '@kairon/core/api/users.api';
import { queryKeys } from '@kairon/core/entities/query-keys';
import { supabase } from '@kairon/core/supabase/client';

import { useAuth } from '@/auth/AuthContext';
import { Kairon } from '@/constants/kairon';
import {
  LEAD_STATUS_ANDAMENTO,
  LEAD_STATUS_CONFIG,
  ROLES_COMERCIAL,
  type LeadStatus,
} from '@/constants/leads';
import { LeadRow } from '@/components/LeadRow';
import { NovoLeadCard } from '@/components/NovoLeadCard';
import { SecaoColapsavelNativa } from '@/components/SecaoColapsavelNativa';
import type { Lead } from '@/types/models';

type Pessoa = { id: string; full_name?: string; email?: string; role?: string; status?: string };

export default function ComercialScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const podeComercial = ROLES_COMERCIAL.includes(user?.role ?? '');

  // 'todos' | 'meus' | <id de um SDR/BDR>
  const [filtro, setFiltro] = useState<'todos' | 'meus' | string>('todos');

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

  // Apenas SDR/BDR ativos podem ser responsaveis (igual web).
  const responsaveis = useMemo(
    () => usuarios.filter((u) => (u.role === 'sdr' || u.role === 'bdr') && u.status === 'active'),
    [usuarios]
  );

  // Leads ativos no pipeline (fora convertidos e perdidos), antes de qualquer filtro.
  const ativos = useMemo(
    () => leads.filter((l) => !l.cliente_id && l.status !== 'perdido'),
    [leads]
  );

  // Leads NOVOS (pendentes): exigem acao imediata. Mostrados SEMPRE (sem o filtro de
  // responsavel — sao "sem dono"), mais recentes primeiro (created_at desc).
  const novos = useMemo(
    () =>
      ativos
        .filter((l) => l.status === 'pendente')
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [ativos]
  );

  // "Em andamento": demais etapas, com o filtro de responsavel aplicado, agrupadas.
  const emAndamentoSecoes = useMemo(() => {
    const filtrados = ativos.filter((l) => {
      if (l.status === 'pendente') return false;
      if (filtro === 'meus') return l.responsavel_id === user?.id;
      if (filtro !== 'todos') return l.responsavel_id === filtro;
      return true;
    });
    return LEAD_STATUS_ANDAMENTO.map((status) => ({
      status,
      leads: filtrados.filter((l) => l.status === status),
    }));
  }, [ativos, filtro, user?.id]);

  const totalEmAndamento = useMemo(
    () => emAndamentoSecoes.reduce((acc, s) => acc + s.leads.length, 0),
    [emAndamentoSecoes]
  );

  const canAssumir = user?.role === 'sdr' || user?.role === 'bdr';

  const filtroLabel = useMemo(() => {
    if (filtro === 'todos') return 'Todos';
    if (filtro === 'meus') return 'Meus leads';
    const p = responsaveis.find((x) => x.id === filtro);
    return p?.full_name || p?.email || 'Responsável';
  }, [filtro, responsaveis]);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={leadsQuery.isFetching}
            onRefresh={() => leadsQuery.refetch()}
            tintColor={Kairon.primary}
          />
        }>
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.bigTitle}>Comercial</Text>
            <View style={styles.filtroSubRow}>
              <View style={[styles.filtroSubDot, filtro !== 'todos' && styles.filtroSubDotActive]} />
              <Text style={styles.filtroSub}>Em andamento · {filtroLabel}</Text>
            </View>
          </View>
          <GlassView style={styles.filtroGlass} glassEffectStyle="regular" isInteractive>
            <Host style={styles.filtroHost}>
              <Menu
                label={
                  <UIImage
                    systemName="line.3.horizontal.decrease"
                    size={20}
                    color={filtro !== 'todos' ? Kairon.primary : Kairon.text}
                  />
                }>
                <UIButton
                  systemImage={filtro === 'todos' ? 'checkmark' : undefined}
                  onPress={() => setFiltro('todos')}
                  label="Todos"
                />
                <UIButton
                  systemImage={filtro === 'meus' ? 'checkmark' : undefined}
                  onPress={() => setFiltro('meus')}
                  label="Meus leads"
                />
                {responsaveis.map((p) => (
                  <UIButton
                    key={p.id}
                    systemImage={filtro === p.id ? 'checkmark' : undefined}
                    onPress={() => setFiltro(p.id)}
                    label={p.full_name || p.email || 'Sem nome'}
                  />
                ))}
              </Menu>
            </Host>
          </GlassView>
        </View>

        {/* Bloco NOVOS LEADS — destaque no topo, acao imediata. */}
        <View style={styles.novosHeader}>
          <View style={[styles.statusDot, { backgroundColor: Kairon.primary }]} />
          <Text style={styles.novosTitle}>Novos leads</Text>
          <Text style={styles.novosCount}>{novos.length}</Text>
        </View>
        {novos.length ? (
          novos.map((lead) => (
            <NovoLeadCard
              key={lead.id}
              lead={lead}
              canAssumir={canAssumir}
              userId={user?.id}
              onPress={() => router.push(`/comercial/${lead.id}`)}
            />
          ))
        ) : (
          <Text style={styles.novosVazio}>
            {leadsQuery.isLoading ? 'Carregando…' : 'Nenhum lead novo no momento 🎉'}
          </Text>
        )}

        {/* Em andamento — etapas que evoluem ao longo de dias. */}
        <Text style={styles.emAndamentoTitle}>Em andamento</Text>
        {totalEmAndamento === 0 ? (
          <Text style={styles.secaoVazia}>Nenhum lead em andamento</Text>
        ) : (
          emAndamentoSecoes
            .filter((s) => s.leads.length > 0)
            .map(({ status, leads: leadsDaSecao }, i) =>
              // Em Atendimento (SLA ativo) fica sempre visivel, como linhas RN. Follow Up
              // e Reuniao Marcada usam a section nativa do SwiftUI (colapsada por padrao).
              status === 'em_atendimento' ? (
                <View key={status} style={i > 0 && styles.secaoGap}>
                  <StatusHeader status={status} count={leadsDaSecao.length} />
                  {leadsDaSecao.map((lead) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      quickContact
                      onPress={() => router.push(`/comercial/${lead.id}`)}
                    />
                  ))}
                </View>
              ) : (
                <SecaoColapsavelNativa
                  key={status}
                  titulo={LEAD_STATUS_CONFIG[status].label}
                  cor={LEAD_STATUS_CONFIG[status].color}
                  leads={leadsDaSecao}
                  onOpenLead={(id) => router.push(`/comercial/${id}`)}
                  style={i > 0 && styles.secaoGapNativa}
                />
              )
            )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusHeader({ status, count }: { status: LeadStatus; count: number }) {
  const cfg = LEAD_STATUS_CONFIG[status];
  return (
    <View style={styles.statusHeader}>
      <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.statusTitle, { color: cfg.color }]}>{cfg.label}</Text>
      <Text style={styles.statusCount}>{count}</Text>
    </View>
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

  novosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 2,
  },
  novosTitle: { color: Kairon.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  novosCount: {
    color: '#fff',
    backgroundColor: Kairon.primary,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    overflow: 'hidden',
  },
  novosVazio: {
    color: Kairon.textMuted,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },

  emAndamentoTitle: {
    color: Kairon.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginTop: 32,
  },

  secaoGap: { marginTop: 12 },
  secaoGapNativa: { marginTop: 8 },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusCount: { color: Kairon.textMuted, fontSize: 12, fontWeight: '700' },
  secaoVazia: { color: Kairon.textMuted, fontSize: 13, paddingHorizontal: 16, paddingVertical: 12 },

  semAcesso: { flex: 1, padding: 16, gap: 12, justifyContent: 'center', alignItems: 'center' },
  semAcessoText: { color: Kairon.textMuted, fontSize: 15, textAlign: 'center' },
});
