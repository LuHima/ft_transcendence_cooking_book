// Ban policy mirrored from the backend (reports/constants/ban-duration-policy.constant.ts)
import type { ReportReason } from '../types/models'

// Durations applied by the backend when ban_duration_days is not sent (DEFAULT_BAN_DURATIONS)
export const DEFAULT_BAN_DAYS: Record<ReportReason, number> = {
	spam_scam: 7,
	copyright_infringement: 14,
	impersonation_misinformation: 14,
	harassment_bullying: 30,
	sexual_content: 30,
	hate_speech: 30,
	violence_threats: 60,
	other: 7,
}

// Moderators cannot ban for longer (MAX_MODERATOR_BAN_DAYS)
export const MODERATOR_MAX_BAN_DAYS = 180

// Max length of moderation free-text fields (descriptions, notes, unban reason)
export const MODERATION_TEXT_MAX = 1000
