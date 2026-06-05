import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { leadsApi } from '@kairon/core/api/leads.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { Kairon } from '@/constants/kairon';
import { LEAD_STATUS_CONFIG, SLA_MS } from '@/constants/leads';
import { initialsOf } from '@/lib/avatar';
import { callPhone, openWhatsApp } from '@/lib/contact';
import { relativeShort } from '@/lib/dates';
import type { Lead } from '@/types/models';

// Verde do WhatsApp, para o icone de mensagem ficar reconhecivel.
const WHATSAPP_GREEN = '#25D366';

/** Badge de SLA de 10min (contagem regressiva) para leads em atendimento. */
function SlaBadge({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = SLA_MS - (now - new Date(startedAt).getTime());
  if (remaining <= 0) {
    return (
      <View style={[styles.badge, styles.badgeExpired]}>
        <Text style={styles.badgeExpiredText}>SLA vencido</Text>
      </View>
    );
  }
  const totalSec = Math.max(0, Math.floor(remaining / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return (
    <View style={[styles.badge, styles.badgeSla]}>
      <Text style={styles.badgeSlaText}>
        {mm}:{ss}
      </Text>
    </View>
  );
}

/**
 * Card de lead no estilo do app Contatos do iOS: avatar circular com iniciais,
 * nome em destaque e subtitulo (empresa · telefone). O conjunto e desenhado para
 * viver dentro de um container "inset grouped" — por isso o separador fica no topo
 * de cada linha (exceto a primeira, via prop `first`).
 *
 * As acoes rapidas no fim da linha dependem do status: leads PENDENTES expoem o
 * botao "Assumir"; os demais com telefone expoem ligar/WhatsApp. Tocar no corpo
 * abre o detalhe.
 */
export function LeadContactCard({
  lead,
  onPress,
  canAssumir,
  userId,
  first,
}: {
  lead: Lead;
  onPress: () => void;
  /** Permite assumir leads pendentes (apenas SDR/BDR). */
  canAssumir?: boolean;
  userId?: string;
  /** Primeira linha do grupo — sem separador no topo. */
  first?: boolean;
}) {
  const queryClient = useQueryClient();
  const statusColor = LEAD_STATUS_CONFIG[lead.status].color;
  const sub = [lead.empresa, lead.telefone].filter(Boolean).join(' · ');
  const data = relativeShort(lead.created_at);
  const isPendente = lead.status === 'pendente';
  const temTelefone = !!lead.telefone;
  const showSla = lead.status === 'em_atendimento' && !!lead.atendimento_iniciado_em;

  const assumir = useMutation({
    mutationFn: () =>
      leadsApi.update(lead.id, { status: 'em_atendimento', responsavel_id: userId ?? null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.leads.all }),
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.row, !first && styles.rowSep, pressed && styles.rowPressed]}
      onPress={onPress}>
      <View style={[styles.avatar, { backgroundColor: `${statusColor}22` }]}>
        <Text style={[styles.avatarText, { color: statusColor }]}>{initialsOf(lead.nome)}</Text>
      </View>

      <View style={styles.middle}>
        <Text style={styles.nome} numberOfLines={1}>
          {lead.nome}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
        {data ? <Text style={styles.tempo}>{data}</Text> : null}
      </View>

      <View style={styles.trailing}>
        {showSla ? <SlaBadge startedAt={lead.atendimento_iniciado_em as string} /> : null}

        {isPendente && canAssumir ? (
          <Pressable
            onPress={() => assumir.mutate()}
            disabled={assumir.isPending}
            hitSlop={6}
            style={[styles.assumirBtn, assumir.isPending && styles.assumirBtnDisabled]}>
            {assumir.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.assumirText}>Assumir</Text>
            )}
          </Pressable>
        ) : temTelefone && !isPendente ? (
          <View style={styles.icons}>
            <Pressable onPress={() => callPhone(lead.telefone)} hitSlop={8} style={styles.iconBtn}>
              <SymbolView name="phone.fill" size={17} tintColor={Kairon.text} />
            </Pressable>
            <Pressable onPress={() => openWhatsApp(lead.telefone)} hitSlop={8} style={styles.iconBtn}>
              <SymbolView name="message.fill" size={17} tintColor={WHATSAPP_GREEN} />
            </Pressable>
          </View>
        ) : (
          <SymbolView name="chevron.right" size={13} tintColor={Kairon.textMuted} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Kairon.cardBorder },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },

  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },

  middle: { flex: 1 },
  nome: { color: Kairon.text, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  sub: { color: Kairon.textMuted, fontSize: 13, marginTop: 2 },
  tempo: { color: Kairon.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },

  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeSla: { backgroundColor: 'rgba(96,165,250,0.10)', borderColor: 'rgba(96,165,250,0.30)' },
  badgeSlaText: { color: Kairon.blue, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badgeExpired: { backgroundColor: 'rgba(248,113,113,0.15)', borderColor: 'rgba(248,113,113,0.35)' },
  badgeExpiredText: { color: Kairon.red, fontSize: 11, fontWeight: '700' },

  assumirBtn: {
    height: 32,
    minWidth: 84,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: Kairon.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assumirBtnDisabled: { opacity: 0.6 },
  assumirText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  icons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
});
