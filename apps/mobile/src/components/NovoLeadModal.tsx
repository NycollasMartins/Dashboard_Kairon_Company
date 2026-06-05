import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { lineLimit, tint } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassView } from 'expo-glass-effect';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { leadsApi } from '@kairon/core/api/leads.api';
import { queryKeys } from '@kairon/core/entities/query-keys';

import { Kairon } from '@/constants/kairon';
import {
  FATURAMENTO_MENSAL_OPTIONS,
  MOMENTO_EMPRESA_OPTIONS,
  ORIGEM_OPTIONS,
} from '@/constants/leads';

type Opcao = { id: string; label: string };

// Cartão "inset grouped" no estilo iOS (mesmo padrão de NovoItemModal).
function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SectionHeader({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function SectionFooter({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionFooter}>{children}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

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
}: {
  label: string;
  value: string | null;
  options: Opcao[];
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const selecionada = options.find((o) => o.id === value);
  return (
    <Row label={label}>
      <Host matchContents>
        <Menu
          label={selecionada ? selecionada.label : placeholder}
          systemImage="chevron.up.chevron.down"
          modifiers={[tint(Kairon.textMuted), lineLimit(1)]}>
          {options.map((o) => (
            <UIButton
              key={o.id}
              systemImage={o.id === value ? 'checkmark' : undefined}
              onPress={() => onChange(o.id)}
              label={o.label}
            />
          ))}
        </Menu>
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

const MOMENTO_OPTS: Opcao[] = MOMENTO_EMPRESA_OPTIONS.map((o) => ({ id: o, label: o }));
const FATURAMENTO_OPTS: Opcao[] = FATURAMENTO_MENSAL_OPTIONS.map((o) => ({ id: o, label: o }));
const ORIGEM_OPTS: Opcao[] = ORIGEM_OPTIONS.map((o) => ({ id: o.value, label: o.label }));

/**
 * Modal de cadastro manual de lead (espelha o LeadNovoModal do web). O lead entra
 * no funil como pendente — o backend (create_lead_from_webhook) cuida disso. Apenas
 * o nome e obrigatorio; os demais campos sao opcionais.
 *
 * O form e semeado vazio pelos initializers do useState; o pai remonta o modal a
 * cada abertura (via `key`), entao nao e preciso reiniciar os campos por effect.
 */
export function NovoLeadModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [origem, setOrigem] = useState('outbound');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [momento, setMomento] = useState<string | null>(null);
  const [faturamento, setFaturamento] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      leadsApi.create({
        nome: nome.trim(),
        empresa: empresa.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        momento_empresa: momento,
        objetivo_principal: objetivo.trim() || null,
        faturamento_mensal: faturamento,
        origem,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      onClose();
    },
  });

  const podeSalvar = nome.trim().length > 0 && !mutation.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <GlassIconButton symbol="xmark" color={Kairon.text} onPress={onClose} />
          <Text style={styles.topTitle}>Novo Lead</Text>
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
            <SectionHeader>Identificação</SectionHeader>
            <Card>
              <TextInput
                value={nome}
                onChangeText={setNome}
                placeholder="Nome do lead"
                placeholderTextColor={Kairon.textMuted}
                style={styles.cellInput}
                autoFocus
              />
              <Divider />
              <TextInput
                value={empresa}
                onChangeText={setEmpresa}
                placeholder="Empresa ou organização"
                placeholderTextColor={Kairon.textMuted}
                style={styles.cellInput}
              />
            </Card>
            <SectionFooter>O nome é obrigatório. O lead entra no funil como pendente.</SectionFooter>

            <SectionHeader>Contato</SectionHeader>
            <Card>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemplo.com"
                placeholderTextColor={Kairon.textMuted}
                style={styles.cellInput}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Divider />
              <TextInput
                value={telefone}
                onChangeText={setTelefone}
                placeholder="(11) 99999-9999"
                placeholderTextColor={Kairon.textMuted}
                style={styles.cellInput}
                keyboardType="phone-pad"
              />
            </Card>

            <SectionHeader>Qualificação</SectionHeader>
            <Card>
              <MenuRow
                label="Origem"
                value={origem}
                options={ORIGEM_OPTS}
                onChange={setOrigem}
                placeholder="Selecione"
              />
              <Divider />
              <MenuRow
                label="Momento da empresa"
                value={momento}
                options={MOMENTO_OPTS}
                onChange={setMomento}
                placeholder="Selecione"
              />
              <Divider />
              <MenuRow
                label="Faturamento mensal"
                value={faturamento}
                options={FATURAMENTO_OPTS}
                onChange={setFaturamento}
                placeholder="Selecione"
              />
            </Card>

            <SectionHeader>Objetivo principal</SectionHeader>
            <Card>
              <TextInput
                value={objetivo}
                onChangeText={setObjetivo}
                placeholder="O que esse lead quer alcançar"
                placeholderTextColor={Kairon.textMuted}
                style={[styles.cellInput, styles.cellInputMultiline]}
                multiline
              />
            </Card>

            {mutation.isError ? (
              <Text style={styles.erro}>Não foi possível criar o lead. Tente novamente.</Text>
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
  cellInputMultiline: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },

  erro: { color: Kairon.red, fontSize: 13, marginTop: 14, marginLeft: 14 },
});
