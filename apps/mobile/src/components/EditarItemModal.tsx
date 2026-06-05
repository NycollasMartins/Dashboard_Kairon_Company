import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  STATUS_CONFIG,
  STATUS_ORDER,
  type TarefaPrioridade,
  type TarefaStatus,
} from '@/constants/kairon';
import { isoToLocalDay, timeHM } from '@/lib/dates';
import type { Evento, Tarefa } from '@/types/models';

const PRIORIDADES = Object.keys(PRIORIDADE_CONFIG) as TarefaPrioridade[];

export type ItemEdicao =
  | { kind: 'tarefa'; data: Tarefa }
  | { kind: 'evento'; data: Evento }
  | null;

/**
 * Sheet de edicao (pageSheet) acionado ao tocar num card da Agenda. Edita os campos
 * principais de uma tarefa ou de um evento e permite excluir. Invalida as queries
 * correspondentes ao salvar/excluir.
 */
export function EditarItemModal({
  item,
  onClose,
}: {
  item: ItemEdicao;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const visible = item != null;

  // Estado comum + por tipo.
  const [titulo, setTitulo] = useState('');
  const [status, setStatus] = useState<TarefaStatus>('pendente');
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('media');
  const [diaTodo, setDiaTodo] = useState(true);
  const [inicio, setInicio] = useState('09:00');
  const [fim, setFim] = useState('10:00');
  const [local, setLocal] = useState('');

  // Semeia o form a partir do item quando o sheet abre.
  useEffect(() => {
    if (!item) return;
    if (item.kind === 'tarefa') {
      setTitulo(item.data.titulo ?? '');
      setStatus(item.data.status ?? 'pendente');
      setPrioridade((item.data.prioridade as TarefaPrioridade) ?? 'media');
    } else {
      const e = item.data;
      setTitulo(e.title ?? '');
      setDiaTodo(!!e.all_day);
      setInicio(e.all_day ? '09:00' : timeHM(e.start_at));
      setFim(e.all_day || !e.end_at ? '10:00' : timeHM(e.end_at));
      setLocal(e.location ?? '');
    }
  }, [item]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item) return;
      if (item.kind === 'tarefa') {
        return tarefasApi.update(item.data.id, { titulo: titulo.trim(), status, prioridade });
      }
      const e = item.data as Evento & {
        audience_type?: string;
        squad_id?: string | null;
        assignee_id?: string | null;
      };
      const dia = isoToLocalDay(e.start_at);
      const start_at = diaTodo ? `${dia}T00:00:00` : `${dia}T${inicio}:00`;
      const end_at = diaTodo ? `${dia}T23:59:00` : `${dia}T${fim}:00`;
      return calendarioApi.update(e.id, {
        title: titulo.trim(),
        description: e.description ?? null,
        type: e.type ?? 'meeting',
        all_day: diaTodo,
        start_at,
        end_at,
        location: local.trim() || null,
        audience_type: e.audience_type ?? 'all',
        squad_id: e.squad_id ?? null,
        assignee_id: e.assignee_id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: item?.kind === 'tarefa' ? queryKeys.tarefas.all : queryKeys.calendario.all,
      });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!item) return;
      return item.kind === 'tarefa'
        ? tarefasApi.delete(item.data.id)
        : calendarioApi.remove(item.data.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: item?.kind === 'tarefa' ? queryKeys.tarefas.all : queryKeys.calendario.all,
      });
      onClose();
    },
  });

  function confirmarExclusao() {
    Alert.alert(
      'Excluir',
      `Tem certeza que deseja excluir ${item?.kind === 'tarefa' ? 'esta tarefa' : 'este evento'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    );
  }

  const ocupado = mutation.isPending || deleteMutation.isPending;
  const podeSalvar = titulo.trim().length > 0 && !ocupado;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
          <Text style={styles.topTitle}>
            {item?.kind === 'evento' ? 'Editar evento' : 'Editar tarefa'}
          </Text>
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
            <Text style={styles.label}>Título</Text>
            <TextInput
              value={titulo}
              onChangeText={setTitulo}
              placeholder={item?.kind === 'evento' ? 'Nome do evento' : 'O que precisa ser feito?'}
              placeholderTextColor={Kairon.textMuted}
              style={styles.input}
            />

            {item?.kind === 'tarefa' ? (
              <>
                <Text style={[styles.label, styles.mt]}>Status</Text>
                <View style={styles.chips}>
                  {STATUS_ORDER.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const sel = status === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setStatus(s)}
                        style={[
                          styles.chip,
                          sel && { backgroundColor: `${cfg.color}22`, borderColor: cfg.color },
                        ]}>
                        <View style={[styles.chipDot, { backgroundColor: cfg.color }]} />
                        <Text style={[styles.chipText, sel && { color: cfg.color }]}>
                          {cfg.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

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
                        <Text style={[styles.chipText, sel && { color: cfg.color }]}>
                          {cfg.label}
                        </Text>
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
            {deleteMutation.isError ? (
              <Text style={styles.erro}>Não foi possível excluir. Tente novamente.</Text>
            ) : null}

            <Pressable
              onPress={confirmarExclusao}
              disabled={ocupado}
              style={[styles.deleteBtn, styles.mt]}>
              {deleteMutation.isPending ? (
                <ActivityIndicator color={Kairon.red} />
              ) : (
                <Text style={styles.deleteText}>Excluir</Text>
              )}
            </Pressable>
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

  deleteBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Kairon.red}55`,
    backgroundColor: `${Kairon.red}14`,
    alignItems: 'center',
  },
  deleteText: { color: Kairon.red, fontSize: 15, fontWeight: '700' },
});
