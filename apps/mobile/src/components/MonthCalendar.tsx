import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Kairon } from '@/constants/kairon';
import { localISO, MONTHS_LONG } from '@/lib/dates';

// Iniciais dos dias da semana, comecando no domingo (igual ao app de Calendario do iOS).
const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const TOTAL_CELLS = 42; // 6 semanas fixas — mantem a altura estavel ao trocar de mes.

export type DiaMarker = { tarefa: boolean; evento: boolean };

type Celula = { iso: string; dayNum: number; inMonth: boolean };

function buildGrid(year: number, month: number): Celula[] {
  const primeiro = new Date(year, month, 1);
  const offset = primeiro.getDay(); // 0 = domingo
  const cells: Celula[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const date = new Date(year, month, 1 - offset + i);
    cells.push({ iso: localISO(date), dayNum: date.getDate(), inMonth: date.getMonth() === month });
  }
  return cells;
}

/**
 * Calendario mensal (grade de 6 semanas). Cabecalho com setas para trocar de mes,
 * dia de hoje em circulo branco, dia selecionado em circulo vermelho Kairon e
 * bolinhas abaixo do numero indicando se ha tarefas (vermelho) e/ou eventos (azul).
 */
export function MonthCalendar({
  selectedIso,
  hojeIso,
  markers,
  onSelectDay,
}: {
  selectedIso: string;
  hojeIso: string;
  markers: Map<string, DiaMarker>;
  onSelectDay: (iso: string) => void;
}) {
  const [y, mIdx] = selectedIso.split('-').map(Number);
  const [view, setView] = useState({ year: y, month: mIdx - 1 });

  const cells = useMemo(() => buildGrid(view.year, view.month), [view]);

  function changeMonth(delta: number) {
    const date = new Date(view.year, view.month + delta, 1);
    setView({ year: date.getFullYear(), month: date.getMonth() });
  }

  function handlePress(cell: Celula) {
    onSelectDay(cell.iso);
    if (!cell.inMonth) {
      const [cy, cm] = cell.iso.split('-').map(Number);
      setView({ year: cy, month: cm - 1 });
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.monthRow}>
        <Pressable onPress={() => changeMonth(-1)} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navChevron}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS_LONG[view.month]} {view.year}
        </Text>
        <Pressable onPress={() => changeMonth(1)} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navChevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekHeader}>
        {WEEKDAY_INITIALS.map((wd, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.weekHeaderText}>{wd}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const selecionado = cell.iso === selectedIso;
          const ehHoje = cell.iso === hojeIso;
          const marker = markers.get(cell.iso);
          return (
            <Pressable key={cell.iso} onPress={() => handlePress(cell)} style={styles.cell}>
              <View
                style={[
                  styles.dayCircle,
                  selecionado && styles.dayCircleSel,
                  !selecionado && ehHoje && styles.dayCircleHoje,
                ]}>
                <Text
                  style={[
                    styles.dayNum,
                    !cell.inMonth && styles.dayNumOut,
                    selecionado && styles.dayNumSel,
                    !selecionado && ehHoje && styles.dayNumHoje,
                  ]}>
                  {cell.dayNum}
                </Text>
              </View>
              <View style={styles.dotsRow}>
                {marker?.tarefa ? (
                  <View style={[styles.markDot, { backgroundColor: Kairon.primary }]} />
                ) : null}
                {marker?.evento ? (
                  <View style={[styles.markDot, { backgroundColor: Kairon.blue }]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 8 },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  monthLabel: { color: Kairon.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navChevron: { color: Kairon.text, fontSize: 26, fontWeight: '500', marginTop: -3 },

  weekHeader: { flexDirection: 'row', marginBottom: 4 },
  weekHeaderText: { color: Kairon.textMuted, fontSize: 12, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },

  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayCircleSel: { backgroundColor: Kairon.primary },
  dayCircleHoje: { backgroundColor: Kairon.text },
  dayNum: { color: Kairon.text, fontSize: 16, fontWeight: '600' },
  dayNumOut: { color: Kairon.textMuted, opacity: 0.45 },
  dayNumSel: { color: '#fff', fontWeight: '700' },
  dayNumHoje: { color: Kairon.bg, fontWeight: '700' },

  dotsRow: { flexDirection: 'row', gap: 3, height: 6, marginTop: 3, alignItems: 'center' },
  markDot: { width: 5, height: 5, borderRadius: 2.5 },
});
