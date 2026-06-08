import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Kairon } from '@/constants/kairon';
import { localISO } from '@/lib/dates';

export type MesView = { year: number; month: number };

// Iniciais dos dias da semana, comecando no domingo (igual ao app de Calendario do iOS).
const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const TOTAL_CELLS = 42; // 6 semanas fixas — mantem a altura estavel ao trocar de mes.

// Largura inicial estimada (corrigida no onLayout). Container tem paddingHorizontal: 8.
const LARGURA_INICIAL = Dimensions.get('window').width - 16;

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

function addMonths({ year, month }: MesView, delta: number): MesView {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/**
 * Calendario mensal (grade de 6 semanas). O mes e controlado pelo parent (`view`).
 * As grades sao paginas de um ScrollView horizontal com `pagingEnabled` — cada mes
 * e uma secao, dando a animacao de paginacao nativa do iOS. Renderizamos sempre 3
 * paginas (anterior / atual / proximo) e, ao fim de cada swipe, atualizamos o mes e
 * recentralizamos na pagina do meio, criando um pager "infinito" e fluido.
 */
export function MonthCalendar({
  selectedIso,
  hojeIso,
  markers,
  onSelectDay,
  view,
  onViewChange,
}: {
  selectedIso: string;
  hojeIso: string;
  markers: Map<string, DiaMarker>;
  onSelectDay: (iso: string) => void;
  view: MesView;
  onViewChange: (view: MesView) => void;
}) {
  const [largura, setLargura] = useState(LARGURA_INICIAL);
  const scrollRef = useRef<ScrollView>(null);

  // Tres meses visiveis: [anterior, atual, proximo].
  const paginas = useMemo<MesView[]>(
    () => [addMonths(view, -1), view, addMonths(view, 1)],
    [view]
  );

  // Sempre recentraliza na pagina do meio (sem animar) quando o mes ou a largura muda.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: largura, animated: false });
  }, [view, largura]);

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const pagina = Math.round(e.nativeEvent.contentOffset.x / largura);
    if (pagina === 1) return; // continua no mes atual
    onViewChange(addMonths(view, pagina - 1)); // 0 -> anterior, 2 -> proximo
  }

  function handlePress(cell: Celula) {
    onSelectDay(cell.iso);
    if (!cell.inMonth) {
      const [cy, cm] = cell.iso.split('-').map(Number);
      onViewChange({ year: cy, month: cm - 1 });
    }
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width - 16)}>
      <View style={styles.weekHeader}>
        {WEEKDAY_INITIALS.map((wd, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.weekHeaderText}>{wd}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        contentOffset={{ x: largura, y: 0 }}
        onMomentumScrollEnd={onMomentumScrollEnd}>
        {paginas.map((pag) => (
          <View key={`${pag.year}-${pag.month}`} style={[styles.pagina, { width: largura }]}>
            {buildGrid(pag.year, pag.month).map((cell) => {
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
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 8 },

  weekHeader: { flexDirection: 'row', marginBottom: 4 },
  weekHeaderText: { color: Kairon.textMuted, fontSize: 10, fontWeight: '600' },

  pagina: { flexDirection: 'row', flexWrap: 'wrap' },
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
