import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { api, getErrorMessage, qs, toPage } from '../../api/client'
import Avatar from '../../components/Avatar'
import Pagination from '../../components/Pagination'
import { ListSkeleton } from '../../components/Skeleton'
import type { Paginated, User, UserRole, UserStatus } from '../../types/models'

// NB: endpoint da esporre lato backend (guard: solo admin)
//   GET    /admin/users?page=&limit=&search=&role=&status=  -> Paginated<User> (va bene anche un array semplice)
//   POST   /admin/users          { username, email, password, role }
//   PATCH  /admin/users/:id      { username?, email?, role?, status?, password? }
//   DELETE /admin/users/:id

const PAGE_SIZE = 15
const ROLES: UserRole[] = ['user', 'moderator', 'admin']
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
	const [data, setData] = useState<Paginated<User> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [debounced, setDebounced] = useState('')
	const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
	const [page, setPage] = useState(1)
	const [reload, setReload] = useState(0)
	const [busyId, setBusyId] = useState<number | null>(null)
	const [editing, setEditing] = useState<User | null>(null)
	const [creating, setCreating] = useState(false)

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
			.get<unknown>(`/admin/users${qs({ page, limit: PAGE_SIZE, search: debounced, role: roleFilter })}`)
			.then((res) => {
				if (cancelled) return
				setData(toPage<User>(res, PAGE_SIZE))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setData(toPage<User>([], PAGE_SIZE))
				setError(getErrorMessage(err, t('admin.users.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [page, debounced, roleFilter, reload, t])

	function replaceUser(updated: User) {
		setData((prev) => (prev ? { ...prev, items: prev.items.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)) } : prev))
	}

	async function patchUser(u: User, patch: Partial<Pick<User, 'role' | 'status'>>) {
		setBusyId(u.id)
		try {
			const updated = await api.patch<User>(`/admin/users/${u.id}`, patch)
			// se il backend risponde senza body si applica la modifica in locale
			replaceUser({ ...u, ...patch, ...(updated ?? {}) })
			toast.success(t('admin.users.updated'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('admin.users.updateError')))
		} finally {
			setBusyId(null)
		}
	}

	async function deleteUser(u: User) {
		if (!confirm(t('admin.users.confirmDelete', { name: u.username }))) return
		setBusyId(u.id)
		try {
			await api.delete(`/admin/users/${u.id}`)
			toast.success(t('admin.users.deleted'))
			if (data && data.items.length === 1 && page > 1) setPage(page - 1)
			else setReload((n) => n + 1)
		} catch (err) {
			toast.error(getErrorMessage(err, t('admin.users.deleteError')))
		} finally {
			setBusyId(null)
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
					<table className="w-full min-w-[760px] border-collapse text-sm">
						<thead>
							<tr className="bg-[var(--wc-surface)] text-left text-[var(--wc-text-muted)]">
								<th className="p-3">{t('admin.users.user')}</th>
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
													onClick={() => deleteUser(u)}
													className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-40"
												>
													{t('common.delete')}
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
					onClose={() => setEditing(null)}
					onSaved={(saved) => {
						replaceUser(saved)
						setEditing(null)
						toast.success(t('admin.users.updated'))
					}}
				/>
			)}
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
	initial?: User
	onClose: () => void
	onSaved: (user: User) => void
}

function UserDialog({ title, initial, onClose, onSaved }: UserDialogProps) {
	const { t } = useTranslation()
	const [username, setUsername] = useState(initial?.username ?? '')
	const [email, setEmail] = useState(initial?.email ?? '')
	const [password, setPassword] = useState('')
	const [role, setRole] = useState<UserRole>(initial?.role ?? 'user')
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setSubmitting(true)
		setError(null)
		try {
			const saved = initial
				? await api.patch<User>(`/admin/users/${initial.id}`, {
						username,
						email,
						role,
						...(password ? { password } : {}),
					})
				: await api.post<User>('/admin/users', { username, email, password, role })
			onSaved({ ...(initial ?? ({} as User)), ...{ username, email, role }, ...(saved ?? {}) } as User)
		} catch (err) {
			setError(getErrorMessage(err, t('form.errors.saveFailed')))
			setSubmitting(false)
		}
	}

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
				className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6"
			>
				<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{title}</h2>
				<div>
					<label htmlFor="au-username" className="mb-1 block text-sm text-[var(--wc-text-muted)]">Username</label>
					<input id="au-username" required value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputClass} w-full`} />
				</div>
				<div>
					<label htmlFor="au-email" className="mb-1 block text-sm text-[var(--wc-text-muted)]">Email</label>
					<input id="au-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} w-full`} />
				</div>
				<div>
					<label htmlFor="au-pass" className="mb-1 block text-sm text-[var(--wc-text-muted)]">Password</label>
					<input
						id="au-pass"
						type="password"
						required={!initial}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder={initial ? t('admin.users.passwordKeep') : ''}
						className={`${inputClass} w-full`}
					/>
				</div>
				<div>
					<label htmlFor="au-role" className="mb-1 block text-sm text-[var(--wc-text-muted)]">{t('admin.users.role')}</label>
					<select id="au-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={`${inputClass} w-full`}>
						{ROLES.map((r) => (
							<option key={r} value={r}>
								{t(`role.${r}`)}
							</option>
						))}
					</select>
				</div>
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
						disabled={submitting}
						className="rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
					>
						{submitting ? t('common.saving') : t('common.save')}
					</button>
				</div>
			</form>
		</div>
	)
}

export default AdminUsers
