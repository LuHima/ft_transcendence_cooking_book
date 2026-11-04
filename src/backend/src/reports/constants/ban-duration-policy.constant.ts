import { ReportReason } from '@prisma/client';

export const DEFAULT_BAN_DURATIONS: Record<ReportReason, number> = {
  spam_scam: 7,
  copyright_infringement: 14,
  impersonation_misinformation: 14,
  harassment_bullying: 30,
  sexual_content: 30,
  hate_speech: 30,
  violence_threats: 60,
  other: 7,
};

export const MAX_MODERATOR_BAN_DAYS = 180;

export function getDefaultBanDuration(reason: ReportReason): number {
  return DEFAULT_BAN_DURATIONS[reason] ?? 7;
}
