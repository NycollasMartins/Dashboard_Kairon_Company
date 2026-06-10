import { metaAdsService } from '@/lib/metaAdsService';
import { googleAdsService } from '@/lib/googleAdsService';

// Resolve o serviço de anúncios pela plataforma da campanha ('meta' | 'google').
export function getAdsService(platform) {
  return platform === 'google' ? googleAdsService : metaAdsService;
}

// Flag de modo mock (mesmo valor para Meta e Google), exposto à UI para sinalizar
// que os números de mídia (gasto, ROAS, conversões) são simulados.
export const adsIsMock = metaAdsService.isMock;

export { metaAdsService, googleAdsService };
