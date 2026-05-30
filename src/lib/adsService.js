import { metaAdsService } from '@/lib/metaAdsService';
import { googleAdsService } from '@/lib/googleAdsService';

// Resolve o serviço de anúncios pela plataforma da campanha ('meta' | 'google').
export function getAdsService(platform) {
  return platform === 'google' ? googleAdsService : metaAdsService;
}

export { metaAdsService, googleAdsService };
