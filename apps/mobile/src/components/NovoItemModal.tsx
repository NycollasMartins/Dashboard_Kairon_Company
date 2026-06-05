import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calendarioApi } from '@kairon/core/api/calendario.api';
import { tarefasApi } from '@kairon/core/api/tarefas.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import {
  Kairon,
  PRIORIDADE_CONFIG,
  type TarefaPrioridade,
} from '@/constants/kairon';
import { MONTHS_LONG } from '@/lib/dates';

type Tipo = 'tarefa' | 'evento';

const PRIORIDADES = Object.keys(PRIORIDADE_CONFIG) as TarefaPrioridade[];

function formatarData(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS_LONG[m - 1]} de ${y}`;
}

export function NovoItemModal({
  visible,
  onClose,
  dateIso,
  defaultTipo = 'tarefa',
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  dateIso: string;
  defaultTipo?: Tipo;
  userId?: string;
}) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<Tipo>(defaultTipo);

  const [titulo, setTitulo] = useState('');
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('media');
  const [diaTodo, setDiaTodo] = useState(true);
  const [inicio, setInicio] = useState('09:00');
  const [fim, setFim] = useState('10:00');
  const [local, setLocal] = useState('');

  // Reinicia o form sempre que (re)abre.
  useEffect(() => {
    if (visible) {
      setTipo(defaultTipo);
      setTitulo('');
      setPrioridade('media');
      setDiaTodo(true);
      setInicio('09:00');
      setFim('10:00');
      setLocal('');
    }
  }, [visible, defaultTipo]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (tipo === 'tarefa') {
        return tarefasApi.create({
          titulo: titulo.trim(),
          prioridade,
          status: 'pendente',
          prazo: dateIso,
          responsavel_id: userId ?? null,
        });
      }
      const start_at = diaTodo ? `${dateIso}T00:00:00` : `${dateIso}T${inicio}:00`;
      const end_at = diaTodo ? `${dateIso}T23:59:00` : `${dateIso}T${fim}:00`;
      return calendarioApi.create({
        title: titulo.trim(),
        type: 'meeting',
        audience_type: 'all',
        all_day: diaTodo,
        start_at,
        end_at,
        location: local.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: tipo === 'tarefa' ? queryKeys.tarefas.all : queryKeys.calendario.all,
      });
      onClose();
    },
  });

  const podeSalvar = titulo.trim().length > 0 && !mutation.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Barra superior */}
        <View style={styles.topbar}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
          <Text style={styles.topTitle}>Novo</Text>
          <Pressable onPress={() => mutation.mutate()} disabled={!podeSalvar} hitSlop={10}>
            {mutation.isPending ? (
              <ActivityIndicator color={Kairon.primary} />
            ) : (
              <Text style={[styles.save, !podeSalvar && styles.saveDisabled]}>Salvar</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Segmented Tarefa / Evento */}
            <View style={styles.segmented}>
              {(['tarefa', 'evento'] as Tipo[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTipo(t)}
                  style={[styles.segment, tipo === t && styles.segmentActive]}>
                  <Text style={[styles.segmentLabel, tipo === t && styles.segmentLabelActive]}>
                    {t === 'tarefa' ? 'Tarefa' : 'Evento'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.paraData}>Para {formatarData(dateIso)}</Text>

            {/* Titulo (comum) */}
            <Text style={styles.label}>Título</Text>
            <TextInput
              value={titulo}
              onChangeText={setTitulo}
              placeholder={tipo === 'tarefa' ? 'O que precisa ser feito?' : 'Nome do evento'}
              placeholderTextColor={Kairon.textMuted}
              style={styles.input}
              autoFocus
            />

            {tipo === 'tarefa' ? (
              <>
                <Text style={[styles.label, styles.mt]}>Prioridade</Text>
                <View style={styles.chips}>
                  {PRIORIDADES.map((p) => {
                    const cfg = PRIORIDADE_CONFIG[p];
                    const sel = prioridade === p;
                    return (
                      <Pressable
                        key={p}
                        onPress={() => setPrioridade(p)}
                        style={[
                          styles.chip,
                          sel && { backgroundColor: `${cfg.color}22`, borderColor: cfg.color },
                        ]}>
                        <View style={[styles.chipDot, { backgroundColor: cfg.color }]} />
                        <Text style={[styles.chipText, sel && { color: cfg.color }]}>{cfg.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View style={[styles.rowBetween, styles.mt]}>
                  <Text style={styles.label}>Dia todo</Text>
                  <Switch
                    value={diaTodo}
                    onValueChange={setDiaTodo}
                    trackColor={{ true: Kairon.primary, false: '#3a3a3a' }}
                  />
                </View>

                {!diaTodo && (
                  <View style={styles.horaRow}>
                    <View style={styles.flex}>
                      <Text style={styles.label}>Início</Text>
                      <TextInput
                        value={inicio}
                        onChangeText={setInicio}
                        placeholder="09:00"
                        placeholderTextColor={Kairon.textMuted}
                        keyboardType="numbers-and-punctuation"
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.label}>Fim</Text>
                      <TextInput
                        value={fim}
                        onChangeText={setFim}
                        placeholder="10:00"
                        placeholderTextColor={Kairon.textMuted}
                        keyboardType="numbers-and-punctuation"
                        style={styles.input}
                      />
                    </View>
                  </View>
                )}

                <Text style={[styles.label, styles.mt]}>Local (opcional)</Text>
                <TextInput
                  value={local}
                  onChangeText={setLocal}
                  placeholder="Sala, link, endereço…"
                  placeholderTextColor={Kairon.textMuted}
                  style={styles.input}
                />
              </>
            )}

            {mutation.isError ? (
              <Text style={styles.erro}>Não foi possível salvar. Tente novamente.</Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: Kairon.bg },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Kairon.cardBorder,
  },
  topTitle: { color: Kairon.text, fontSize: 16, fontWeight: '700' },
  cancel: { color: Kairon.textMuted, fontSize: 15 },
  save: { color: Kairon.primary, fontSize: 15, fontWeight: '700' },
  saveDisabled: { color: Kairon.textMuted, opacity: 0.6 },

  content: { padding: 16, gap: 6 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Kairon.bgElevated,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 8,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.10)' },
  segmentLabel: { color: Kairon.textMuted, fontSize: 14, fontWeight: '600' },
  segmentLabelActive: { color: Kairon.text },

  paraData: { color: Kairon.textMuted, fontSize: 13, marginBottom: 8 },

  label: { color: Kairon.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  mt: { marginTop: 14 },
  input: {
    backgroundColor: Kairon.bgElevated,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Kairon.text,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Kairon.cardBorder,
    backgroundColor: Kairon.bgElevated,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: Kairon.text, fontSize: 13, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  horaRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  erro: { color: Kairon.red, fontSize: 13, marginTop: 14 },
});
