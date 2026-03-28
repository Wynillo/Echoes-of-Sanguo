// ============================================================
// ECHOES OF SANGUO — Campaign Data Store
// Global stores populated by tcg-loader from base.tcg
// ============================================================

import type { CampaignData } from '@wynillo/tcg-format';

export let CAMPAIGN_DATA: CampaignData | null = null;
export const CAMPAIGN_IMAGES = new Map<string, string>();  // path → blob URL
export const CAMPAIGN_I18N   = new Map<string, Record<string, string>>(); // lang → KV

export function setCampaignData(data: CampaignData): void {
  CAMPAIGN_DATA = data;
}
