import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { Kairon } from '@/constants/kairon';

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function KpiCard({
  value,
  label,
  sub,
  color,
}: {
  value: string | number;
  label: string;
  sub?: string;
  color: string;
}) {
  return (
    <View style={[styles.card, styles.kpi]}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Kairon.card,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    color: Kairon.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  kpi: { flex: 1, minWidth: '47%' },
  kpiValue: { fontSize: 26, fontWeight: '800' },
  kpiLabel: { color: Kairon.text, fontSize: 13, fontWeight: '600', marginTop: 4 },
  kpiSub: { color: Kairon.textMuted, fontSize: 12, marginTop: 2 },
});
