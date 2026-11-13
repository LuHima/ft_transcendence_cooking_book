import { ApiError } from '../api/client'
import type { AccountBannedDetails } from '../types/models'

// Detects the 403 { code: 'ACCOUNT_BANNED', details } response of /auth/signin and /auth/signin/google
export function getAccountBannedDetails(err: unknown): AccountBannedDetails | null {
	if (!(err instanceof ApiError) || err.status !== 403) return null
	const body = err.body as { code?: unknown; details?: Partial<AccountBannedDetails> } | null
	if (!body || body.code !== 'ACCOUNT_BANNED' || !body.details) return null
	const d = body.details
	return {
		reason: d.reason ?? 'other',
		description: d.description ?? null,
		banned_until: d.banned_until ?? null,
		is_permanent: Boolean(d.is_permanent),
	}
}
