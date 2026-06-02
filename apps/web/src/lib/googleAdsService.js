import { createAdsService } from '@/lib/adsServiceCore';

// Google Ads API — intermediada pela Edge Function `google-ads`.
// Mesma interface do metaAdsService (listCampaigns, getMetrics,
// createCampaign, pauseCampaign, resumeCampaign, endCampaign).
export const googleAdsService = createAdsService({
  platform: 'google',
  edgeFunction: 'google-ads',
  label: 'Google Ads',
});
