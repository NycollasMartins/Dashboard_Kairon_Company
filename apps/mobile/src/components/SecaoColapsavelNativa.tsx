import { DisclosureGroup, HStack, Host, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundColor, onTapGesture, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Kairon } from '@/constants/kairon';
import { relativeShort } from '@/lib/dates';
import type { Lead } from '@/types/models';

/**
 * Seção colapsável NATIVA (SwiftUI `DisclosureGroup`) para as etapas que evoluem ao
 * longo de dias (Follow Up / Reunião Marcada). Nasce colapsada; o chevron e a animação
 * são os nativos do iOS. O `Host` com `matchContents` vertical redimensiona a altura na
 * árvore RN ao expandir/colapsar, então a ScrollView reflui naturalmente.
 *
 * As linhas são compostas por primitivos SwiftUI (VStack/HStack/Text) — conteúdo dentro
 * de um componente nativo não aceita Views do React Native.
 */
export function SecaoColapsavelNativa({
  titulo,
  cor,
  leads,
  onOpenLead,
  style,
}: {
  titulo: string;
  cor: string;
  leads: Lead[];
  onOpenLead: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <Host matchContents={{ vertical: true }} colorScheme="dark" style={[styles.host, style]}>
      <DisclosureGroup
        label={`${titulo} · ${leads.length}`}
        isExpanded={aberto}
        onIsExpandedChange={setAberto}
        modifiers={[tint(cor)]}>
        <VStack alignment="leading" spacing={0}>
          {leads.map((lead) => (
            <LinhaNativa key={lead.id} lead={lead} onPress={() => onOpenLead(lead.id)} />
          ))}
        </VStack>
      </DisclosureGroup>
    </Host>
  );
}

function LinhaNativa({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const sub = [lead.empresa, lead.telefone].filter(Boolean).join(' · ');
  const data = relativeShort(lead.created_at);

  return (
    <HStack
      alignment="center"
      spacing={8}
      modifiers={[padding({ vertical: 8 }), onTapGesture(onPress)]}>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[foregroundColor(Kairon.text), font({ size: 15, weight: 'semibold' })]}>
          {lead.nome}
        </Text>
        {sub ? (
          <Text modifiers={[foregroundColor(Kairon.textMuted), font({ size: 12 })]}>{sub}</Text>
        ) : null}
      </VStack>
      <Spacer />
      {data ? (
        <Text modifiers={[foregroundColor(Kairon.textMuted), font({ size: 12, weight: 'semibold' })]}>
          {data}
        </Text>
      ) : null}
    </HStack>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: 'stretch', marginHorizontal: 16 },
});
