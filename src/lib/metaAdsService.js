import { createAdsService } from '@/lib/adsServiceCore';

// Meta Marketing API — intermediada pela Edge Function `meta-ads`.
// Interface comum: listCampaigns, getMetrics, createCampaign,
// pauseCampaign, resumeCampaign, endCampaign.
export const metaAdsService = createAdsService({
  platform: 'meta',
  edgeFunction: 'meta-ads',
  label: 'Meta Ads',
});
