import type { CampaignData } from './campaign-types.js';

export let CAMPAIGN_DATA: CampaignData | null = null;
export const CAMPAIGN_IMAGES = new Map<string, string>();  // path → blob URL
export const CAMPAIGN_I18N   = new Map<string, Record<string, string>>(); // lang → KV

export function setCampaignData(data: CampaignData): void {
  CAMPAIGN_DATA = data;
}
