import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Kairon } from '@/constants/kairon';
import { SLA_MS } from '@/constants/leads';
import { callPhone, openWhatsApp } from '@/lib/contact';
import { relativeShort } from '@/lib/dates';
import type { Lead } from '@/types/models';

// Verde do WhatsApp, para o icone de mensagem ficar reconhecivel.
const WHATSAPP_GREEN = '#25D366';

/** Iniciais (1-2 letras) de um nome, igual ao web (LeadCard.jsx). */
function initialsOf(name = ''): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTE = [
  { bg: 'rgba(234,57,53,0.12)', fg: '#EA3935' },
  { bg: 'rgba(59,130,246,0.14)', fg: '#60A5FA' },
  { bg: 'rgba(16,185,129,0.14)', fg: '#34D399' },
  { bg: 'rgba(168,85,247,0.14)', fg: '#C084FC' },
  { bg: 'rgba(245,158,11,0.14)', fg: '#FBBF24' },
  { bg: 'rgba(236,72,153,0.14)', fg: '#F472B6' },
];

/** Cor estavel por chave (hash), igual ao web. */
function avatarColor(key?: string) {
  if (!key) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

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

export function LeadRow({
  lead,
  onPress,
  quickContact,
}: {
  lead: Lead;
  onPress: () => void;
  /** Mostra icones minimalistas de ligar/WhatsApp (usado em Em Atendimento). */
  quickContact?: boolean;
}) {
  const responsavelNome = lead.responsavel?.full_name || lead.responsavel?.email;
  const sub = [lead.empresa, lead.telefone].filter(Boolean).join(' · ');
  const showSla = lead.status === 'em_atendimento' && lead.atendimento_iniciado_em;
  const data = relativeShort(lead.created_at);
  const showContato = quickContact && !!lead.telefone;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {lead.nome}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {showSla ? (
          <SlaBadge startedAt={lead.atendimento_iniciado_em as string} />
        ) : data ? (
          <Text style={styles.data}>{data}</Text>
        ) : null}
        {responsavelNome ? (
          <View
            style={[styles.avatar, { backgroundColor: avatarColor(responsavelNome).bg }]}>
            <Text style={[styles.avatarText, { color: avatarColor(responsavelNome).fg }]}>
              {initialsOf(responsavelNome)}
            </Text>
          </View>
        ) : null}
        {showContato ? (
          <View style={styles.contatoIcons}>
            <Pressable onPress={() => callPhone(lead.telefone)} hitSlop={8} style={styles.iconBtn}>
              <SymbolView name="phone.fill" size={18} tintColor={Kairon.text} />
            </Pressable>
            <Pressable onPress={() => openWhatsApp(lead.telefone)} hitSlop={8} style={styles.iconBtn}>
              <SymbolView name="message.fill" size={18} tintColor={WHATSAPP_GREEN} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Kairon.cardBorder,
  },
  title: { color: Kairon.text, fontSize: 15, fontWeight: '600' },
  sub: { color: Kairon.textMuted, fontSize: 12, marginTop: 2 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  data: { color: Kairon.textMuted, fontSize: 12, fontWeight: '600' },

  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeSla: { backgroundColor: 'rgba(96,165,250,0.10)', borderColor: 'rgba(96,165,250,0.30)' },
  badgeSlaText: { color: Kairon.blue, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badgeExpired: { backgroundColor: 'rgba(248,113,113,0.15)', borderColor: 'rgba(248,113,113,0.35)' },
  badgeExpiredText: { color: Kairon.red, fontSize: 11, fontWeight: '700' },

  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 11, fontWeight: '700' },

  contatoIcons: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 2 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
