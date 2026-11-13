import { ReportReason } from '@prisma/client';
import {
  DEFAULT_BAN_DURATIONS,
  MAX_MODERATOR_BAN_DAYS,
  getDefaultBanDuration,
} from './ban-duration-policy.constant';

describe('BanDurationPolicyMatrix', () => {
  it('defines the 180-day maximum moderator ban cap', () => {
    expect(MAX_MODERATOR_BAN_DAYS).toBe(180);
  });

  it('contains expected baseline duration mappings for all 8 canonical reasons', () => {
    expect(DEFAULT_BAN_DURATIONS[ReportReason.spam_scam]).toBe(7);
    expect(DEFAULT_BAN_DURATIONS[ReportReason.copyright_infringement]).toBe(14);
    expect(
      DEFAULT_BAN_DURATIONS[ReportReason.impersonation_misinformation],
    ).toBe(14);
    expect(DEFAULT_BAN_DURATIONS[ReportReason.harassment_bullying]).toBe(30);
    expect(DEFAULT_BAN_DURATIONS[ReportReason.sexual_content]).toBe(30);
    expect(DEFAULT_BAN_DURATIONS[ReportReason.hate_speech]).toBe(30);
    expect(DEFAULT_BAN_DURATIONS[ReportReason.violence_threats]).toBe(60);
    expect(DEFAULT_BAN_DURATIONS[ReportReason.other]).toBe(7);
  });

  it('getDefaultBanDuration returns correct duration for valid reason', () => {
    expect(getDefaultBanDuration(ReportReason.violence_threats)).toBe(60);
    expect(getDefaultBanDuration(ReportReason.harassment_bullying)).toBe(30);
    expect(getDefaultBanDuration(ReportReason.spam_scam)).toBe(7);
  });

  it('getDefaultBanDuration returns fallback 7 days for unknown reason', () => {
    expect(getDefaultBanDuration('non_existent_reason' as any)).toBe(7);
  });
});
