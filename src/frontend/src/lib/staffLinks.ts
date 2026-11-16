// Deep links between the staff panels (/admin for admins, /moderation for moderators).
// The panels keep their active tab and report filters in the URL:
//   /admin?tab=reports&subject=recipe&target_id=12&status=pending
//   /moderation?tab=reports&report_id=34&resolve=1   (opens the resolution dialog)
import { useLocation } from 'react-router-dom'
import { qs } from '../api/client'
import type { ReportLinkFilters } from '../types/models'

export type StaffBasePath = '/admin' | '/moderation'

export function staffBasePath(pathname: string): StaffBasePath {
	return pathname.startsWith('/moderation') ? '/moderation' : '/admin'
}

// Panel the user is currently in (links stay inside /moderation for moderators)
export function useStaffBasePath(): StaffBasePath {
	return staffBasePath(useLocation().pathname)
}

export function reportsHref(base: StaffBasePath, filters: ReportLinkFilters = {}): string {
	return `${base}${qs({
		tab: 'reports',
		subject: filters.subject,
		target_id: filters.target_id,
		status: filters.status,
		report_id: filters.report_id,
		resolve: filters.resolve ? '1' : undefined,
	})}`
}
