import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { leadsApi } from '@kairon/core/api/leads.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { Kairon } from '@/constants/kairon';
import { relativeShort } from '@/lib/dates';
import type { Lead } from '@/types/models';

/**
 * Card de um lead NOVO (pendente). A unica acao e "Assumir" (canto inferior direito):
 * atribui o lead a mim como responsavel e o move para Em Atendimento (o trigger do
 * banco faz a promocao). So depois, ja em atendimento, aparecem as acoes de ligar/
 * WhatsApp. Tocar no corpo do card abre o detalhe.
 */
export function NovoLeadCard({
  lead,
  canAssumir,
  userId,
  onPress,
}: {
  lead: Lead;
  canAssumir: boolean;
  userId?: string;
  onPress: () => void;
}) {
  const queryClient = useQueryClient();
  const sub = [lead.empresa, lead.telefone].filter(Boolean).join(' · ');
  const espera = relativeShort(lead.created_at);

  const assumir = useMutation({
    mutationFn: () =>
      leadsApi.update(lead.id, { status: 'em_atendimento', responsavel_id: userId ?? null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.leads.all }),
  });

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.accent} />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <View style={styles.flex}>
            <Text style={styles.nome} numberOfLines={1}>
              {lead.nome}
            </Text>
            {sub ? (
              <Text style={styles.sub} numberOfLines={1}>
                {sub}
              </Text>
            ) : null}
          </View>
          {espera ? <Text style={styles.espera}>{espera}</Text> : null}
        </View>

        {canAssumir ? (
          <View style={styles.assumirRow}>
            <Pressable
              onPress={() => assumir.mutate()}
              disabled={assumir.isPending}
              style={[styles.assumirBtn, assumir.isPending && styles.assumirBtnDisabled]}>
              {assumir.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.assumirText}>Assumir</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {assumir.isError ? (
          <Text style={styles.erro}>Não foi possível assumir. Tente de novo.</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: Kairon.bgElevated,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    overflow: 'hidden',
  },
  accent: { width: 4, backgroundColor: Kairon.primary },
  body: { flex: 1, padding: 14 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nome: { color: Kairon.text, fontSize: 16, fontWeight: '700' },
  sub: { color: Kairon.textMuted, fontSize: 13, marginTop: 2 },
  espera: { color: Kairon.textMuted, fontSize: 12, fontWeight: '600' },

  assumirRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  assumirBtn: {
    minWidth: 104,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 18,
    backgroundColor: Kairon.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assumirBtnDisabled: { opacity: 0.6 },
  assumirText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  erro: { color: Kairon.red, fontSize: 12, marginTop: 8 },
});
