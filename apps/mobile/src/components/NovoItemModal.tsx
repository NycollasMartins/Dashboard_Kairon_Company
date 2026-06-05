import { Button as UIButton, DatePicker, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { datePickerStyle, labelsHidden, lineLimit, tint } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
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
import { clientesApi } from '@kairon/core/api/clientes.api';
import { projetosApi } from '@kairon/core/api/projetos.api';
import { squadsApi } from '@kairon/core/api/squads.api';
import { tarefasApi } from '@kairon/core/api/tarefas.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import {
  EVENTO_TIPO_CONFIG,
  Kairon,
  PRIORIDADE_CONFIG,
  type EventoAudiencia,
  type EventoTipo,
  type TarefaPrioridade,
} from '@/constants/kairon';

type Tipo = 'tarefa' | 'evento';

const PRIORIDADES = Object.keys(PRIORIDADE_CONFIG) as TarefaPrioridade[];
const TIPOS_EVENTO = Object.keys(EVENTO_TIPO_CONFIG) as EventoTipo[];
const AUDIENCIAS: { value: EventoAudiencia; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'squad', label: 'Um squad' },
  { value: 'user', label: 'Uma pessoa' },
];

type Pessoa = { id: string; full_name?: string; email?: string };
type Cliente = { id: string; nome: string; status?: string };
type Squad = { id: string; nome: string };
type Projeto = { id: string; nome: string };
type Opcao = { id: string; label: string };

// Cartão "inset grouped" no estilo iOS: agrupa linhas relacionadas.
function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

// Cabeçalho de seção (texto cinza acima de um cartão).
function SectionHeader({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

// Texto auxiliar abaixo de um cartão.
function SectionFooter({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionFooter}>{children}</Text>;
}

// Divisória fina recuada, como entre linhas de uma lista iOS.
function Divider() {
  return <View style={styles.divider} />;
}

// Linha genérica: rótulo à esquerda, controle à direita.
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

// Linha com seletor via Menu nativo do SwiftUI (valor + chevron, checkmark no ativo).
function MenuRow({
  label,
  value,
  options,
  onChange,
  placeholder,
  emptyText,
}: {
  label: string;
  value: string | null;
  options: Opcao[];
  onChange: (id: string) => void;
  placeholder: string;
  emptyText?: string;
}) {
  const selecionada = options.find((o) => o.id === value);
  return (
    <Row label={label}>
      <Host matchContents>
        <Menu
          label={selecionada ? selecionada.label : placeholder}
          systemImage="chevron.up.chevron.down"
          modifiers={[tint(Kairon.textMuted), lineLimit(1)]}>
          {options.length === 0 ? (
            <UIButton label={emptyText ?? 'Nenhuma opção'} />
          ) : (
            options.map((o) => (
              <UIButton
                key={o.id}
                systemImage={o.id === value ? 'checkmark' : undefined}
                onPress={() => onChange(o.id)}
                label={o.label}
              />
            ))
          )}
        </Menu>
      </Host>
    </Row>
  );
}

// Linha com o DatePicker nativo do SwiftUI (estilo compacto: pílula que abre o calendário).
function DateRow({
  label,
  value,
  withTime,
  minDate,
  onChange,
}: {
  label: string;
  value: Date;
  withTime?: boolean;
  minDate?: Date;
  onChange: (d: Date) => void;
}) {
  return (
    <Row label={label}>
      <Host matchContents>
        <DatePicker
          selection={value}
          range={minDate ? { start: minDate } : undefined}
          displayedComponents={withTime ? ['date', 'hourAndMinute'] : ['date']}
          onDateChange={onChange}
          modifiers={[datePickerStyle('compact'), labelsHidden(), tint(Kairon.primary)]}
        />
      </Host>
    </Row>
  );
}

// Botão circular com efeito de vidro e ícone SF Symbol (fechar / salvar).
function GlassIconButton({
  symbol,
  color,
  onPress,
  disabled,
  loading,
}: {
  symbol: ComponentProps<typeof UIImage>['systemName'];
  color: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8}>
      <GlassView style={styles.glassBtn} glassEffectStyle="regular" isInteractive>
        {loading ? (
          <ActivityIndicator color={Kairon.text} />
        ) : (
          <Host matchContents>
            <UIImage systemName={symbol} size={17} color={disabled ? Kairon.textMuted : color} />
          </Host>
        )}
      </GlassView>
    </Pressable>
  );
}

// Cria um Date local a partir de um ISO 'YYYY-MM-DD' (com hora opcional).
function dateFromIso(iso: string, hour = 0, min = 0): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hour, min, 0, 0);
}

// 'YYYY-MM-DD' a partir dos componentes locais do Date.
function toLocalDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 'YYYY-MM-DDTHH:MM:00' (datetime local ingênuo, mesmo formato usado pela API).
function toLocalDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${toLocalDay(d)}T${hh}:${mm}:00`;
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
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('media');
  const [diaTodo, setDiaTodo] = useState(true);
  const [local, setLocal] = useState('');

  // Datas escolhidas (iniciam no dia selecionado na agenda).
  const [prazoDate, setPrazoDate] = useState<Date>(() => dateFromIso(dateIso));
  const [inicioDate, setInicioDate] = useState<Date>(() => dateFromIso(dateIso, 9, 0));
  const [fimDate, setFimDate] = useState<Date>(() => dateFromIso(dateIso, 10, 0));

  // Tarefa: responsável / cliente / projeto.
  const [responsavelId, setResponsavelId] = useState<string | null>(userId ?? null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [projetoId, setProjetoId] = useState<string | null>(null);

  // Evento: tipo + público-alvo.
  const [eventoTipo, setEventoTipo] = useState<EventoTipo>('meeting');
  const [audiencia, setAudiencia] = useState<EventoAudiencia>('all');
  const [squadId, setSquadId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);

  // Dados auxiliares (só busca enquanto o modal está aberto).
  const pessoasQuery = useQuery({
    queryKey: queryKeys.calendario.people,
    queryFn: calendarioApi.listPeople,
    enabled: visible,
  });
  const clientesQuery = useQuery({
    queryKey: queryKeys.clientes.all,
    queryFn: clientesApi.list,
    enabled: visible,
  });
  const squadsQuery = useQuery({
    queryKey: queryKeys.squads.all,
    queryFn: squadsApi.list,
    enabled: visible && tipo === 'evento',
  });
  const projetosQuery = useQuery({
    queryKey: queryKeys.projetos.byCliente(clienteId ?? ''),
    queryFn: () => projetosApi.byCliente(clienteId as string),
    enabled: visible && tipo === 'tarefa' && !!clienteId,
  });

  const pessoas: Pessoa[] = pessoasQuery.data ?? [];
  const clientes: Cliente[] = (clientesQuery.data ?? []).filter((c: Cliente) => c.status !== 'churn');
  const squads: Squad[] = squadsQuery.data ?? [];
  const projetos: Projeto[] = projetosQuery.data ?? [];

  const pessoaOpts: Opcao[] = pessoas.map((p) => ({ id: p.id, label: p.full_name || p.email || 'Sem nome' }));
  const clienteOpts: Opcao[] = clientes.map((c) => ({ id: c.id, label: c.nome }));
  const squadOpts: Opcao[] = squads.map((s) => ({ id: s.id, label: s.nome }));
  const projetoOpts: Opcao[] = projetos.map((p) => ({ id: p.id, label: p.nome }));

  const prioridadeOpts: Opcao[] = PRIORIDADES.map((p) => ({ id: p, label: PRIORIDADE_CONFIG[p].label }));
  const tipoOpts: Opcao[] = TIPOS_EVENTO.map((t) => ({ id: t, label: EVENTO_TIPO_CONFIG[t].label }));
  const audienciaOpts: Opcao[] = AUDIENCIAS.map((a) => ({ id: a.value, label: a.label }));

  // Reinicia o form sempre que (re)abre.
  useEffect(() => {
    if (visible) {
      setTipo(defaultTipo);
      setTitulo('');
      setDescricao('');
      setPrioridade('media');
      setDiaTodo(true);
      setLocal('');
      setPrazoDate(dateFromIso(dateIso));
      setInicioDate(dateFromIso(dateIso, 9, 0));
      setFimDate(dateFromIso(dateIso, 10, 0));
      setResponsavelId(userId ?? null);
      setClienteId(null);
      setProjetoId(null);
      setEventoTipo('meeting');
      setAudiencia('all');
      setSquadId(null);
      setAssigneeId(null);
    }
  }, [visible, defaultTipo, userId, dateIso]);

  // "Começa" mudou: mantém o término sempre depois do início (mínimo +1h).
  function handleInicio(d: Date) {
    setInicioDate(d);
    if (fimDate <= d) setFimDate(new Date(d.getTime() + 60 * 60 * 1000));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (tipo === 'tarefa') {
        return tarefasApi.create({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          prioridade,
          status: 'pendente',
          prazo: toLocalDay(prazoDate),
          responsavel_id: responsavelId || null,
          cliente_id: clienteId || null,
          projeto_id: projetoId || null,
        });
      }
      const start_at = diaTodo ? `${toLocalDay(inicioDate)}T00:00:00` : toLocalDateTime(inicioDate);
      const end_at = diaTodo ? `${toLocalDay(fimDate)}T23:59:00` : toLocalDateTime(fimDate);
      return calendarioApi.create({
        title: titulo.trim(),
        type: eventoTipo,
        description: descricao.trim() || null,
        audience_type: audiencia,
        squad_id: audiencia === 'squad' ? squadId : null,
        assignee_id: audiencia === 'user' ? assigneeId : null,
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

  // Evento com público específico exige escolher o alvo.
  const audienciaOk =
    tipo === 'tarefa' ||
    audiencia === 'all' ||
    (audiencia === 'squad' && !!squadId) ||
    (audiencia === 'user' && !!assigneeId);
  const podeSalvar = titulo.trim().length > 0 && audienciaOk && !mutation.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Barra superior com botões de ícone em vidro */}
        <View style={styles.topbar}>
          <GlassIconButton symbol="xmark" color={Kairon.text} onPress={onClose} />
          <Text style={styles.topTitle}>Nova Demanda</Text>
          <GlassIconButton
            symbol="checkmark"
            color={Kairon.primary}
            onPress={() => mutation.mutate()}
            disabled={!podeSalvar}
            loading={mutation.isPending}
          />
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

            {/* Grupo: título + descrição */}
            <Card>
              <TextInput
                value={titulo}
                onChangeText={setTitulo}
                placeholder={tipo === 'tarefa' ? 'Título' : 'Título'}
                placeholderTextColor={Kairon.textMuted}
                style={styles.cellInput}
                autoFocus
              />
              <Divider />
              <TextInput
                value={descricao}
                onChangeText={setDescricao}
                placeholder={tipo === 'tarefa' ? 'Notas, contexto, links…' : 'Pauta, observações…'}
                placeholderTextColor={Kairon.textMuted}
                style={[styles.cellInput, styles.cellInputMultiline]}
                multiline
              />
            </Card>

            {tipo === 'tarefa' ? (
              <>
                <SectionHeader>Detalhes</SectionHeader>
                <Card>
                  <MenuRow
                    label="Prioridade"
                    value={prioridade}
                    options={prioridadeOpts}
                    onChange={(id) => setPrioridade(id as TarefaPrioridade)}
                    placeholder="Selecione"
                  />
                  <Divider />
                  <MenuRow
                    label="Responsável"
                    value={responsavelId}
                    options={pessoaOpts}
                    onChange={setResponsavelId}
                    placeholder="Selecione"
                    emptyText="Nenhuma pessoa"
                  />
                  <Divider />
                  <DateRow label="Prazo" value={prazoDate} onChange={setPrazoDate} />
                </Card>

                <SectionHeader>Vínculo</SectionHeader>
                <Card>
                  <MenuRow
                    label="Cliente"
                    value={clienteId}
                    options={clienteOpts}
                    onChange={(id) => {
                      setClienteId(id);
                      setProjetoId(null);
                    }}
                    placeholder="Nenhum"
                    emptyText="Nenhum cliente"
                  />
                  {clienteId ? (
                    <>
                      <Divider />
                      <MenuRow
                        label="Projeto"
                        value={projetoId}
                        options={projetoOpts}
                        onChange={setProjetoId}
                        placeholder="Nenhum"
                        emptyText="Sem projetos"
                      />
                    </>
                  ) : null}
                </Card>
                <SectionFooter>Cliente e projeto são opcionais.</SectionFooter>
              </>
            ) : (
              <>
                <SectionHeader>Detalhes</SectionHeader>
                <Card>
                  <MenuRow
                    label="Tipo"
                    value={eventoTipo}
                    options={tipoOpts}
                    onChange={(id) => setEventoTipo(id as EventoTipo)}
                    placeholder="Selecione"
                  />
                  <Divider />
                  <MenuRow
                    label="Atribuir para"
                    value={audiencia}
                    options={audienciaOpts}
                    onChange={(id) => setAudiencia(id as EventoAudiencia)}
                    placeholder="Selecione"
                  />
                  {audiencia === 'squad' ? (
                    <>
                      <Divider />
                      <MenuRow
                        label="Squad"
                        value={squadId}
                        options={squadOpts}
                        onChange={setSquadId}
                        placeholder="Selecionar"
                        emptyText="Nenhum squad"
                      />
                    </>
                  ) : null}
                  {audiencia === 'user' ? (
                    <>
                      <Divider />
                      <MenuRow
                        label="Pessoa"
                        value={assigneeId}
                        options={pessoaOpts}
                        onChange={setAssigneeId}
                        placeholder="Selecionar"
                        emptyText="Nenhuma pessoa"
                      />
                    </>
                  ) : null}
                </Card>

                <SectionHeader>Data e hora</SectionHeader>
                <Card>
                  <Row label="Dia inteiro">
                    <Switch
                      value={diaTodo}
                      onValueChange={setDiaTodo}
                      trackColor={{ true: Kairon.primary, false: '#3a3a3a' }}
                    />
                  </Row>
                  <Divider />
                  <DateRow
                    label="Começa"
                    value={inicioDate}
                    withTime={!diaTodo}
                    onChange={handleInicio}
                  />
                  <Divider />
                  <DateRow
                    label="Termina"
                    value={fimDate}
                    withTime={!diaTodo}
                    minDate={inicioDate}
                    onChange={setFimDate}
                  />
                </Card>

                <SectionHeader>Local</SectionHeader>
                <Card>
                  <TextInput
                    value={local}
                    onChangeText={setLocal}
                    placeholder="Sala, link, endereço…"
                    placeholderTextColor={Kairon.textMuted}
                    style={styles.cellInput}
                  />
                </Card>
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
    paddingVertical: 12,
  },
  topTitle: { color: Kairon.text, fontSize: 17, fontWeight: '700' },
  glassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  content: { padding: 16, paddingBottom: 48 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Kairon.bgElevated,
    borderRadius: 999,
    padding: 4,
    gap: 4,
    marginBottom: 20,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  segmentLabel: { color: Kairon.textMuted, fontSize: 14, fontWeight: '600' },
  segmentLabelActive: { color: Kairon.text },

  // Cartões "inset grouped"
  card: {
    backgroundColor: Kairon.bgElevated,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  sectionHeader: {
    color: Kairon.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 8,
    marginLeft: 14,
  },
  sectionFooter: {
    color: Kairon.textMuted,
    fontSize: 12,
    marginTop: 2,
    marginLeft: 14,
    marginBottom: 8,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Kairon.cardBorder, marginLeft: 16 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowLabel: { color: Kairon.text, fontSize: 16 },
  rowValue: { marginLeft: 'auto', maxWidth: '62%', alignItems: 'flex-end' },

  cellInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Kairon.text,
    fontSize: 16,
  },
  cellInputMultiline: { minHeight: 64, paddingTop: 12, textAlignVertical: 'top' },

  erro: { color: Kairon.red, fontSize: 13, marginTop: 14, marginLeft: 14 },
});
