import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { api, asArray, getErrorMessage, qs, toPage, uploadWithProgress } from '../../api/client'
import { UPLOAD_LIMITS } from '../../config'
import UploadProgress from '../../components/UploadProgress'
import { useLang } from '../../lib/useLang'
import { IMAGE_ACCEPT, validateImage } from '../../lib/files'
import { useObjectUrl } from '../../lib/useObjectUrl'
import Avatar from '../../components/Avatar'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { ListSkeleton } from '../../components/Skeleton'
import type { AdminUser, AvatarUploadResponseDto, BanHistoryItem, Paginated, SortOrder, UserRole, UserSortBy, UserStatus } from '../../types/models'

// endpoint admin (guard: solo admin)
//   GET    /admin/users?page=&limit=&search=&role=&status=&sort_by=&sort_order=  -> PaginatedAdminUsersResponseDto
//   POST   /admin/users                 { username, email, password, role }
//   PATCH  /admin/users/:id             { username?, email?, role?, status?, password? }
//   DELETE /admin/users/:id             disattivazione (soft delete)
//   DELETE /admin/users/:id?hard=true   eliminazione definitiva
//   GET    /admin/users/:id/ban-history -> BanHistoryItemDto[]
//   POST   /admin/users/:id/avatar      (multipart, campo "file")
//   DELETE /admin/users/:id/avatar

const PAGE_SIZE = 15
const ROLES: UserRole[] = ['user', 'moderator', 'admin']
const STATUSES: UserStatus[] = ['active', 'disabled', 'banned']
// la ricerca admin rifiuta (400) testi più corti di 2 caratteri
const MIN_SEARCH = 2
const SORT_OPTIONS = [
	{ value: 'created_at:desc', label: 'newest' },
	{ value: 'created_at:asc', label: 'oldest' },
	{ value: 'username:asc', label: 'usernameAsc' },
	{ value: 'username:desc', label: 'usernameDesc' },
	{ value: 'recipes_count:desc', label: 'mostRecipes' },
	{ value: 'recipes_count:asc', label: 'fewestRecipes' },
] as const
const STATUS_COLOR: Record<UserStatus, string> = {
	active: 'text-[var(--wc-basil)]',
	disabled: 'text-[var(--wc-saffron)]',
	banned: 'text-[var(--wc-paprika)]',
}

const inputClass =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]'

function AdminUsers() {
	const { t } = useTranslation()
	const toast = useToast()
	const { user: me } = useAuth()
	const lang = useLang()
	const [data, setData] = useState<Paginated<AdminUser> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [debounced, setDebounced] = useState('')
	const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
	const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('')
	const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]['value']>('created_at:desc')
	const [page, setPage] = useState(1)
	const [reload, setReload] = useState(0)
	const [busyId, setBusyId] = useState<number | null>(null)
	const [editing, setEditing] = useState<AdminUser | null>(null)
	const [creating, setCreating] = useState(false)
	const [deleting, setDeleting] = useState<AdminUser | null>(null)
	const [purging, setPurging] = useState<AdminUser | null>(null)
	const [history, setHistory] = useState<AdminUser | null>(null)
	const [sortBy, sortOrder] = sort.split(':') as [UserSortBy, SortOrder]

	// la ricerca parte 300ms dopo l'ultimo tasto
	useEffect(() => {
		const id = window.setTimeout(() => {
			setDebounced(search.trim())
			setPage(1)
		}, 300)
		return () => window.clearTimeout(id)
	}, [search])

	useEffect(() => {
		let cancelled = false
		api
			.get<unknown>(
				`/admin/users${qs({
					page,
					limit: PAGE_SIZE,
					search: debounced.length >= MIN_SEARCH ? debounced : undefined,
					role: roleFilter,
					status: statusFilter,
					sort_by: sortBy,
					sort_order: sortOrder,
				})}`,
			)
			.then((res) => {
				if (cancelled) return
				setData(toPage<AdminUser>(res, PAGE_SIZE))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setData(toPage<AdminUser>([], PAGE_SIZE))
				setError(getErrorMessage(err, t('admin.users.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [page, debounced, roleFilter, statusFilter, sortBy, sortOrder, reload, t])

	function replaceUser(updated: Partial<AdminUser> & { id: number }) {
		setData((prev) => (prev ? { ...prev, items: prev.items.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)) } : prev))
	}

	async function patchUser(u: AdminUser, patch: Partial<Pick<AdminUser, 'role' | 'status'>>) {
		setBusyId(u.id)
		try {
			const updated = await api.patch<AdminUser>(`/admin/users/${u.id}`, patch)
			// se il backend risponde senza body si applica la modifica in locale
			replaceUser({ ...u, ...patch, ...(updated ?? {}) })
			toast.success(t('admin.users.updated'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('admin.users.updateError')))
		} finally {
			setBusyId(null)
		}
	}

	// hard=false → disattivazione (soft delete); hard=true → eliminazione definitiva dell'account
	async function deleteUser(u: AdminUser, hard: boolean) {
		setBusyId(u.id)
		try {
			await api.delete(`/admin/users/${u.id}${qs({ hard: hard ? 'true' : undefined })}`)
			toast.success(t(hard ? 'admin.users.purged' : 'admin.users.deleted'))
			if (data && data.items.length === 1 && page > 1) setPage(page - 1)
			else setReload((n) => n + 1)
		} catch (err) {
			toast.error(getErrorMessage(err, t('admin.users.deleteError')))
		} finally {
			setBusyId(null)
			setDeleting(null)
			setPurging(null)
		}
	}

	const users = data?.items ?? []

	return (
		<div>
			<div className="flex flex-wrap items-center gap-3">
				<input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={t('admin.users.filter')}
					aria-label={t('admin.users.filter')}
					className={`${inputClass} w-full max-w-xs`}
				/>
				<select
					value={roleFilter}
					aria-label={t('admin.users.role')}
					onChange={(e) => {
						setRoleFilter(e.target.value as UserRole | '')
						setPage(1)
					}}
					className={inputClass}
				>
					<option value="">{t('admin.users.allRoles')}</option>
					{ROLES.map((r) => (
						<option key={r} value={r}>
							{t(`role.${r}`)}
						</option>
					))}
				</select>
				<select
					value={statusFilter}
					aria-label={t('admin.users.status')}
					onChange={(e) => {
						setStatusFilter(e.target.value as UserStatus | '')
						setPage(1)
					}}
					className={inputClass}
				>
					<option value="">{t('admin.users.allStatuses')}</option>
					{STATUSES.map((s) => (
						<option key={s} value={s}>
							{t(`admin.users.statuses.${s}`)}
						</option>
					))}
				</select>
				<select
					value={sort}
					aria-label={t('search.sortBy')}
					onChange={(e) => {
						setSort(e.target.value as (typeof SORT_OPTIONS)[number]['value'])
						setPage(1)
					}}
					className={inputClass}
				>
					{SORT_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{t(`admin.users.sort.${o.label}`)}
						</option>
					))}
				</select>
				<button
					onClick={() => setCreating(true)}
					className="ml-auto rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
				>
					+ {t('admin.users.new')}
				</button>
			</div>

			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{!data && <div className="mt-4"><ListSkeleton /></div>}
			{data && users.length === 0 && !error && <p className="mt-6 text-[var(--wc-text-muted)]">{t('admin.users.empty')}</p>}

			{users.length > 0 && (
				<div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--wc-border)]">
					<table className="w-full min-w-[900px] border-collapse text-sm">
						<thead>
							<tr className="bg-[var(--wc-surface)] text-left text-[var(--wc-text-muted)]">
								<th className="p-3">{t('admin.users.user')}</th>
								<th className="p-3">{t('admin.users.recipes')}</th>
								<th className="p-3">{t('admin.users.role')}</th>
								<th className="p-3">{t('admin.users.status')}</th>
								<th className="p-3 text-right">{t('admin.users.actions')}</th>
							</tr>
						</thead>
						<tbody>
							{users.map((u) => {
								const isSelf = me?.id === u.id
								const status = u.status ?? 'active'
								return (
									<tr key={u.id} className="border-t border-[var(--wc-border)]">
										<td className="p-3">
											<Link to={`/users/${u.id}`} className="flex items-center gap-3 hover:text-[var(--wc-saffron)]">
												<Avatar username={u.username} url={u.avatar_url} className="h-8 w-8 text-sm" />
												<span>
													<span className="block font-medium">
														{u.username}
														{isSelf && <span className="ml-1 text-xs text-[var(--wc-text-muted)]">({t('admin.users.you')})</span>}
													</span>
													<span className="block text-xs text-[var(--wc-text-muted)]">{u.email}</span>
												</span>
											</Link>
										</td>
										<td className="p-3 text-[var(--wc-text-muted)]">
											{u.recipes_count ?? '—'}
											{u.created_at && (
												<span className="block text-xs">
													{t('admin.users.joined', {
														date: new Date(u.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }),
													})}
												</span>
											)}
										</td>
										<td className="p-3">
											<select
												value={u.role}
												disabled={isSelf || busyId === u.id}
												onChange={(e) => patchUser(u, { role: e.target.value as UserRole })}
												aria-label={t('admin.users.roleOf', { name: u.username })}
												className={`${inputClass} py-1.5 disabled:opacity-50`}
											>
												{ROLES.map((r) => (
													<option key={r} value={r}>
														{t(`role.${r}`)}
													</option>
												))}
											</select>
										</td>
										<td className="p-3">
											<span className={`font-medium ${STATUS_COLOR[status]}`}>{t(`admin.users.statuses.${status}`)}</span>
											{status === 'banned' && (
												<span className="block text-xs text-[var(--wc-text-muted)]">
													{u.banned_until
														? t('admin.users.bannedUntil', {
																date: new Date(u.banned_until).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }),
															})
														: t('admin.users.bannedPermanent')}
												</span>
											)}
											{(status === 'banned' || (u.previous_bans_count ?? 0) > 0) && (
												<button
													onClick={() => setHistory(u)}
													className="mt-1 block text-xs text-[var(--wc-saffron)] hover:underline"
												>
													{t('admin.users.banHistory')}
													{(u.previous_bans_count ?? 0) > 0 && ` (${u.previous_bans_count})`}
												</button>
											)}
										</td>
										<td className="p-3">
											<div className="flex flex-wrap items-center justify-end gap-2">
												<button
													onClick={() => setEditing(u)}
													className="rounded-full border border-[var(--wc-border)] px-3 py-1 hover:border-[var(--wc-basil)]"
												>
													{t('common.edit')}
												</button>
												{status === 'active' ? (
													<>
														<button
															disabled={isSelf || busyId === u.id}
															onClick={() => patchUser(u, { status: 'disabled' })}
															className="rounded-full border border-[var(--wc-border)] px-3 py-1 hover:border-[var(--wc-saffron)] disabled:opacity-40"
														>
															{t('admin.users.disable')}
														</button>
														<button
															disabled={isSelf || busyId === u.id}
															onClick={() => {
																if (confirm(t('admin.users.confirmBan', { name: u.username }))) patchUser(u, { status: 'banned' })
															}}
															className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-40"
														>
															{t('admin.users.ban')}
														</button>
													</>
												) : (
													<button
														disabled={busyId === u.id}
														onClick={() => patchUser(u, { status: 'active' })}
														className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-[var(--wc-basil)] hover:border-[var(--wc-basil)] disabled:opacity-40"
													>
														{t('admin.users.reactivate')}
													</button>
												)}
												<button
													disabled={isSelf || busyId === u.id}
													onClick={() => setDeleting(u)}
													title={t('admin.users.deactivateHelp')}
													className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-40"
												>
													{t('common.delete')}
												</button>
												<button
													disabled={isSelf || busyId === u.id}
													onClick={() => setPurging(u)}
													className="rounded-full border border-[var(--wc-paprika)] px-3 py-1 font-medium text-[var(--wc-paprika)] hover:bg-[var(--wc-paprika)] hover:text-[var(--wc-bg)] disabled:opacity-40"
												>
													{t('admin.users.purge')}
												</button>
											</div>
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

			{data && <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />}

			{editing && (
				<UserDialog
					title={t('admin.users.editTitle', { name: editing.username })}
					initial={editing}
					onAvatarChanged={(id, avatar_url) => {
						replaceUser({ id, avatar_url })
						setEditing((prev) => (prev && prev.id === id ? { ...prev, avatar_url } : prev))
					}}
					onClose={() => setEditing(null)}
					onSaved={(saved) => {
						replaceUser(saved)
						setEditing(null)
						toast.success(t('admin.users.updated'))
					}}
				/>
			)}
			{deleting && (
				<ConfirmDialog
					title={t('admin.users.confirmDeleteTitle', { name: deleting.username })}
					confirmLabel={t('common.delete')}
					danger
					onConfirm={() => deleteUser(deleting, false)}
					onClose={() => setDeleting(null)}
				>
					<p>{t('admin.users.confirmDelete', { name: deleting.username })}</p>
				</ConfirmDialog>
			)}
			{purging && (
				<ConfirmDialog
					title={t('admin.users.confirmPurgeTitle', { name: purging.username })}
					confirmLabel={t('admin.users.purge')}
					danger
					requireText={purging.username}
					onConfirm={() => deleteUser(purging, true)}
					onClose={() => setPurging(null)}
				>
					<p>{t('admin.users.confirmPurge', { name: purging.username })}</p>
				</ConfirmDialog>
			)}
			{history && <BanHistoryDialog user={history} onClose={() => setHistory(null)} />}
			{creating && (
				<UserDialog
					title={t('admin.users.new')}
					onClose={() => setCreating(false)}
					onSaved={() => {
						setCreating(false)
						toast.success(t('admin.users.created'))
						setReload((n) => n + 1)
					}}
				/>
			)}
		</div>
	)
}

interface UserDialogProps {
	title: string
	// se presente è una modifica, altrimenti una creazione
	initial?: AdminUser
	onClose: () => void
	onSaved: (user: AdminUser) => void
	// aggiornamento immediato della tabella quando l'admin cambia o rimuove l'avatar
	onAvatarChanged?: (id: number, avatarUrl: string | null) => void
}

// campi personali e di anagrafica modificabili dall'admin (UpdateAdminUserDto)
const PERSONAL_FIELDS = ['first_name', 'last_name', 'birth_date', 'phone', 'address', 'city', 'postal_code'] as const
type PersonalField = (typeof PERSONAL_FIELDS)[number]
const PERSONAL_MAX: Record<PersonalField, number> = {
	first_name: 100,
	last_name: 100,
	birth_date: 10,
	phone: 30,
	address: 255,
	city: 100,
	postal_code: 10,
}
const BIO_MAX = 500
const PASSWORD_MIN = 8

type Personal = Record<PersonalField, string>

// valori del form a partire dall'utente (birth_date in formato YYYY-MM-DD per l'input date)
function personalOf(u?: Partial<AdminUser> | null): Personal {
	return {
		first_name: u?.first_name ?? '',
		last_name: u?.last_name ?? '',
		birth_date: u?.birth_date ? String(u.birth_date).slice(0, 10) : '',
		phone: u?.phone ?? '',
		address: u?.address ?? '',
		city: u?.city ?? '',
		postal_code: u?.postal_code ?? '',
	}
}

// creazione o modifica di un utente. In modifica si carica la scheda completa con GET /admin/users/:id
// (bio e anagrafica) e PATCH /admin/users/:id invia solo i campi cambiati; la password, se compilata,
// viene reimpostata e il backend chiude le sessioni attive dell'utente.
function UserDialog({ title, initial, onClose, onSaved, onAvatarChanged }: UserDialogProps) {
	const { t } = useTranslation()
	const [username, setUsername] = useState(initial?.username ?? '')
	const [email, setEmail] = useState(initial?.email ?? '')
	const [password, setPassword] = useState('')
	const [role, setRole] = useState<UserRole>(initial?.role ?? 'user')
	const [bio, setBio] = useState(initial?.bio ?? '')
	const [personal, setPersonal] = useState<Personal>(() => personalOf(initial))
	// scheda completa caricata dal server: serve per confrontare i campi modificati
	const [detail, setDetail] = useState<AdminUser | null>(null)
	const [loadingDetail, setLoadingDetail] = useState(Boolean(initial))
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!initial) return
		let cancelled = false
		api
			.get<AdminUser>(`/admin/users/${initial.id}`)
			.then((u) => {
				if (cancelled || !u) return
				setDetail(u)
				setUsername(u.username)
				setEmail(u.email)
				setRole(u.role)
				setBio(u.bio ?? '')
				setPersonal(personalOf(u))
			})
			.catch((err) => {
				if (!cancelled) setError(getErrorMessage(err, t('admin.users.detailError')))
			})
			.finally(() => {
				if (!cancelled) setLoadingDetail(false)
			})
		return () => {
			cancelled = true
		}
	}, [initial, t])

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setError(null)
		if (password && password.length < PASSWORD_MIN) return setError(t('admin.users.passwordTooShort', { min: PASSWORD_MIN }))
		setSubmitting(true)
		try {
			let saved: AdminUser | null
			if (initial) {
				const base = detail ?? initial
				const before = personalOf(base)
				// solo i campi cambiati rispetto alla scheda caricata
				const patch: Record<string, string> = {}
				if (username !== base.username) patch.username = username
				if (email !== base.email) patch.email = email
				if (role !== base.role) patch.role = role
				if (password) patch.password = password
				if (bio.trim() !== (base.bio ?? '')) patch.bio = bio.trim()
				for (const f of PERSONAL_FIELDS) {
					if (personal[f].trim() !== before[f]) patch[f] = personal[f].trim()
				}
				saved = Object.keys(patch).length > 0 ? await api.patch<AdminUser>(`/admin/users/${initial.id}`, patch) : base
			} else {
				saved = await api.post<AdminUser>('/admin/users', { username, email, password, role })
			}
			// se il backend risponde senza body si usano i valori del form
			onSaved(Object.assign({}, initial, { username, email, role, bio }, saved ?? {}) as AdminUser)
		} catch (err) {
			setError(getErrorMessage(err, t('form.errors.saveFailed')))
			setSubmitting(false)
		}
	}

	const label = 'mb-1 block text-sm text-[var(--wc-text-muted)]'

	return (
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose()
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onClose()
			}}
		>
			<form
				onSubmit={handleSubmit}
				className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6"
			>
				<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{title}</h2>
				{initial && <AvatarManager user={detail ?? initial} onChanged={(avatar_url) => onAvatarChanged?.(initial.id, avatar_url)} />}

				<fieldset disabled={loadingDetail} className="space-y-4">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label htmlFor="au-username" className={label}>Username</label>
							<input id="au-username" required minLength={3} maxLength={30} value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputClass} w-full`} />
						</div>
						<div>
							<label htmlFor="au-email" className={label}>Email</label>
							<input id="au-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} w-full`} />
						</div>
						<div>
							<label htmlFor="au-role" className={label}>{t('admin.users.role')}</label>
							<select id="au-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={`${inputClass} w-full`}>
								{ROLES.map((r) => (
									<option key={r} value={r}>
										{t(`role.${r}`)}
									</option>
								))}
							</select>
						</div>
						<div>
							<label htmlFor="au-pass" className={label}>{initial ? t('admin.users.passwordReset') : 'Password'}</label>
							<input
								id="au-pass"
								type="password"
								autoComplete="new-password"
								required={!initial}
								minLength={PASSWORD_MIN}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder={initial ? t('admin.users.passwordKeep') : ''}
								className={`${inputClass} w-full`}
							/>
						</div>
					</div>
					{initial && password && <p className="-mt-2 text-xs text-[var(--wc-saffron)]">{t('admin.users.passwordResetHelp')}</p>}

					{initial && (
						<>
							<div>
								<label htmlFor="au-bio" className={label}>{t('profile.bio')}</label>
								<textarea id="au-bio" rows={3} maxLength={BIO_MAX} value={bio} onChange={(e) => setBio(e.target.value)} className={`${inputClass} w-full`} />
								<p className="mt-1 text-right text-xs text-[var(--wc-text-muted)]">
									{bio.length}/{BIO_MAX}
								</p>
							</div>

							<fieldset className="rounded-xl border border-[var(--wc-border)] p-3">
								<legend className="px-1 text-sm text-[var(--wc-text-muted)]">{t('nav.personalData')}</legend>
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									{PERSONAL_FIELDS.map((f) => (
										<div key={f} className={f === 'address' ? 'sm:col-span-2' : ''}>
											<label htmlFor={`au-${f}`} className={label}>
												{t(`admin.users.fields.${f}`)}
											</label>
											<input
												id={`au-${f}`}
												type={f === 'birth_date' ? 'date' : f === 'phone' ? 'tel' : 'text'}
												maxLength={PERSONAL_MAX[f]}
												value={personal[f]}
												onChange={(e) => setPersonal((prev) => ({ ...prev, [f]: e.target.value }))}
												className={`${inputClass} w-full`}
											/>
										</div>
									))}
								</div>
							</fieldset>
						</>
					)}
				</fieldset>

				{error && <p className="text-sm text-[var(--wc-paprika)]">{error}</p>}
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-full border border-[var(--wc-border)] px-4 py-2 text-sm hover:border-[var(--wc-basil)]"
					>
						{t('common.cancel')}
					</button>
					<button
						type="submit"
						disabled={submitting || loadingDetail}
						className="rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
					>
						{loadingDetail ? t('common.loading') : submitting ? t('common.saving') : t('common.save')}
					</button>
				</div>
			</form>
		</div>
	)
}

// avatar di un account gestito: POST /admin/users/:id/avatar (multipart "file") e DELETE /admin/users/:id/avatar
function AvatarManager({ user, onChanged }: { user: AdminUser; onChanged: (avatarUrl: string | null) => void }) {
	const { t } = useTranslation()
	const toast = useToast()
	const fileRef = useRef<HTMLInputElement>(null)
	const [file, setFile] = useState<File | null>(null)
	const [busy, setBusy] = useState(false)
	const [progress, setProgress] = useState<number | null>(null)
	const preview = useObjectUrl(file)

	function pick(f: File | undefined) {
		if (!f) return
		// controllo prima dell'invio: tipo e dimensione massima dell'avatar
		const err = validateImage(f, t, UPLOAD_LIMITS.avatarMaxMb)
		if (err) return toast.error(err)
		setFile(f)
	}

	async function upload() {
		if (!file) return
		setBusy(true)
		try {
			const form = new FormData()
			form.append('file', file)
			setProgress(0)
			const res = await uploadWithProgress<AvatarUploadResponseDto | null>(`/admin/users/${user.id}/avatar`, form, (loaded, total) =>
				setProgress(total > 0 ? (loaded / total) * 100 : 0),
			)
			onChanged(res?.avatar_url ?? user.avatar_url ?? null)
			setFile(null)
			toast.success(t('admin.users.avatarUpdated'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('admin.users.avatarError')))
		} finally {
			setBusy(false)
			setProgress(null)
		}
	}

	async function remove() {
		setBusy(true)
		try {
			await api.delete(`/admin/users/${user.id}/avatar`)
			onChanged(null)
			toast.success(t('profile.avatarRemoved'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('admin.users.avatarError')))
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-3">
				{preview ? (
					<img src={preview} alt="" className="h-14 w-14 rounded-full object-cover" />
				) : (
					<Avatar username={user.username} url={user.avatar_url} className="h-14 w-14 text-lg" />
				)}
				<input
					ref={fileRef}
					type="file"
					accept={IMAGE_ACCEPT}
					aria-label={t('profile.changeAvatar')}
					className="hidden"
					onChange={(e) => {
						pick(e.target.files?.[0])
						e.target.value = ''
					}}
				/>
				{file ? (
					<>
						<button
							type="button"
							disabled={busy}
							onClick={() => void upload()}
							className="rounded-full bg-[var(--wc-basil)] px-3 py-1 text-sm font-medium text-[var(--wc-bg)] disabled:opacity-60"
						>
							{busy ? t('common.sending') : t('admin.users.uploadAvatar')}
						</button>
						<button type="button" disabled={busy} onClick={() => setFile(null)} className="text-sm text-[var(--wc-text-muted)] hover:underline">
							{t('common.cancel')}
						</button>
					</>
				) : (
					<>
						<button
							type="button"
							disabled={busy}
							onClick={() => fileRef.current?.click()}
							className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-sm hover:border-[var(--wc-basil)]"
						>
							{t('profile.changeAvatar')}
						</button>
						{user.avatar_url && (
							<button
								type="button"
								disabled={busy}
								onClick={() => void remove()}
								className="text-sm text-[var(--wc-paprika)] hover:underline disabled:opacity-60"
							>
								{t('common.remove')}
							</button>
						)}
					</>
				)}
			</div>
			{progress !== null && <UploadProgress percent={progress} label={t('profile.avatarUploading')} />}
		</div>
	)
}

// storico delle sanzioni: GET /admin/users/:id/ban-history
function BanHistoryDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
	const { t } = useTranslation()
	const lang = useLang()
	const [items, setItems] = useState<BanHistoryItem[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		api
			.get<BanHistoryItem[]>(`/admin/users/${user.id}/ban-history`)
			.then((res) => {
				if (!cancelled) setItems(asArray<BanHistoryItem>(res))
			})
			.catch((err) => {
				if (cancelled) return
				setItems([])
				setError(getErrorMessage(err, t('admin.users.banHistoryError')))
			})
		return () => {
			cancelled = true
		}
	}, [user.id, t])

	const fmt = (iso: string | null) =>
		iso ? new Date(iso).toLocaleString(lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

	return (
		<div
			className="fixed inset-0 z-[90] flex justify-end bg-black/60"
			role="dialog"
			aria-modal="true"
			aria-label={t('admin.users.banHistoryTitle', { name: user.username })}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose()
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onClose()
			}}
		>
			{/* pannello laterale (slide-over) */}
			<div className="h-full w-full max-w-lg overflow-y-auto border-l border-[var(--wc-border)] bg-[var(--wc-bg)] p-6">
				<div className="flex items-start justify-between gap-3">
					<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{t('admin.users.banHistoryTitle', { name: user.username })}</h2>
					<button autoFocus onClick={onClose} aria-label={t('common.close')} className="text-xl text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]">
						×
					</button>
				</div>

				{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
				{!items && (
					<div className="mt-4">
						<ListSkeleton rows={3} />
					</div>
				)}
				{items && items.length === 0 && !error && <p className="mt-4 text-sm text-[var(--wc-text-muted)]">{t('admin.users.banHistoryEmpty')}</p>}

				<ol className="mt-4 space-y-3">
					{items?.map((b) => (
						<li key={b.id} className="rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4 text-sm">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="rounded-full border border-[var(--wc-paprika)] px-2 py-0.5 text-xs text-[var(--wc-paprika)]">
									{t(`report.reasons.${b.reason}`)}
								</span>
								<span className="text-xs font-medium text-[var(--wc-text)]">
									{b.is_permanent ? t('admin.users.bannedPermanent') : t('admin.users.banDays', { count: b.duration_days ?? 0 })}
								</span>
							</div>
							<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
								<dt className="text-[var(--wc-text-muted)]">{t('admin.users.banStart')}</dt>
								<dd>{fmt(b.banned_at)}</dd>
								<dt className="text-[var(--wc-text-muted)]">{t('admin.users.banEnd')}</dt>
								<dd>{b.is_permanent ? '∞' : fmt(b.expires_at)}</dd>
								{b.unbanned_at && (
									<>
										<dt className="text-[var(--wc-text-muted)]">{t('admin.users.unbannedAt')}</dt>
										<dd>
											{fmt(b.unbanned_at)}
											{b.unbanned_by_id != null && ` · #${b.unbanned_by_id}`}
										</dd>
									</>
								)}
								<dt className="text-[var(--wc-text-muted)]">{t('admin.users.bannedBy')}</dt>
								<dd>
									<Link to={`/users/${b.banned_by_id}`} className="hover:underline">
										#{b.banned_by_id}
									</Link>
									{b.report_id != null && ` · ${t('admin.users.fromReport', { id: b.report_id })}`}
								</dd>
							</dl>
							{b.description && (
								<p className="mt-2 whitespace-pre-line break-words text-xs text-[var(--wc-text)]">
									<span className="text-[var(--wc-text-muted)]">{t('moderation.userMessage')}: </span>
									{b.description}
								</p>
							)}
							{b.unban_reason && (
								<p className="mt-1 whitespace-pre-line break-words text-xs text-[var(--wc-text-muted)]">
									{t('admin.users.unbanReason')}: {b.unban_reason}
								</p>
							)}
						</li>
					))}
				</ol>
			</div>
		</div>
	)
}

export default AdminUsers
