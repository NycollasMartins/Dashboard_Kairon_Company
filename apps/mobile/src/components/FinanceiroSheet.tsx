import { Host, Image as UIImage } from '@expo/ui/swift-ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, type ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clientesApi } from '@kairon/core/api/clientes.api';
import { mrrDoCliente } from '@kairon/core/api/contratos.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { Kairon } from '@/constants/kairon';

type Cliente = { status?: string; contratos?: { tipo?: string; status?: string; valor?: number }[] };

// Formata em reais com separador de milhar, sem depender de Intl/ICU completo.
function formatBRL(v: number): string {
  const n = Math.round(v);
  return `R$ ${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function FinanceiroSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const clientesQuery = useQuery({
    queryKey: queryKeys.clientes.all,
    queryFn: clientesApi.list,
    enabled: visible,
  });

  // Metricas financeiras: MRR ativo, contratos ativos e clientes ativos.
  const fin = useMemo(() => {
    const clientes: Cliente[] = clientesQuery.data ?? [];
    let mrr = 0;
    let contratosAtivos = 0;
    let clientesAtivos = 0;
    for (const c of clientes) {
      if (c.status !== 'churn') {
        clientesAtivos += 1;
        mrr += mrrDoCliente(c.contratos);
      }
      for (const ct of c.contratos ?? []) {
        if (ct.status === 'ativo') contratosAtivos += 1;
      }
    }
    return { mrr, contratosAtivos, clientesAtivos };
  }, [clientesQuery.data]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.titulo}>Financeiro</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.fechar}>Fechar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.finGrid}>
            <FinCard
              value={formatBRL(fin.mrr)}
              label="MRR do mês"
              sub="recorrente ativo"
              color={Kairon.text}
              icon="chart.line.uptrend.xyaxis"
              wide
            />
            <FinCard
              value={fin.contratosAtivos}
              label="Contratos"
              sub="ativos"
              color={Kairon.text}
              icon="doc.text"
            />
            <FinCard
              value={fin.clientesAtivos}
              label="Clientes"
              sub="ativos"
              color={Kairon.text}
              icon="person.2"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function FinCard({
  value,
  label,
  sub,
  color,
  icon,
  wide,
}: {
  value: string | number;
  label: string;
  sub?: string;
  color: string;
  icon: ComponentProps<typeof UIImage>['systemName'];
  wide?: boolean;
}) {
  return (
    <View style={[styles.finCard, wide && styles.finCardWide]}>
      <Host style={styles.finIcon}>
        <UIImage systemName={icon} size={20} color={Kairon.primary} />
      </Host>
      <Text style={[styles.finValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.finLabel}>{label}</Text>
      {sub ? <Text style={styles.finSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Kairon.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  titulo: { color: Kairon.text, fontSize: 20, fontWeight: '700' },
  fechar: { color: Kairon.primary, fontSize: 16, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 48 },

  finGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  finCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Kairon.card,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  finCardWide: { minWidth: '100%' },
  finIcon: { width: 24, height: 24, marginBottom: 10 },
  finValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  finLabel: { color: Kairon.text, fontSize: 14, fontWeight: '600', marginTop: 6 },
  finSub: { color: Kairon.textMuted, fontSize: 12, marginTop: 2 },
});
