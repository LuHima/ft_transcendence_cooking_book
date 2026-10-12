import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api, ApiError, asArray } from '../../api/client'
import Avatar from '../../components/Avatar'
import type { User, UserRole, UserStatus } from '../../types/models'

// NB: endpoint da esporre lato backend (guard: solo admin)
//   GET    /admin/users          -> User[]
//   POST   /admin/users          { username, email, password, role }
//   PATCH  /admin/users/:id      { username?, email?, role?, status?, password? }
//   DELETE /admin/users/:id

const STATUS_LABEL: Record<UserStatus, string> = {
	active: 'Attivo',
	disabled: 'Disattivato',
	banned: 'Bannato',
}

const STATUS_COLOR: Record<UserStatus, string> = {
	active: 'text-[var(--wc-basil)]',
	disabled: 'text-[var(--wc-saffron)]',
	banned: 'text-[var(--wc-paprika)]',
}

const inputClass =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]'

function AdminUsers() {
	const { user: me } = useAuth()
	const [users, setUsers] = useState<User[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [filter, setFilter] = useState('')
	const [busyId, setBusyId] = useState<number | null>(null)
	const [editing, setEditing] = useState<User | null>(null)
	const [creating, setCreating] = useState(false)

	useEffect(() => {
		api
			.get<User[]>('/admin/users')
			.then((data) => setUsers(asArray<User>(data)))
			.catch((err) => {
				setUsers([])
				setError(err instanceof ApiError ? err.message : 'Impossibile caricare gli utenti.')
			})
	}, [])

	const visible = useMemo(() => {
		const q = filter.trim().toLowerCase()
		if (!q || !users) return users ?? []
		return users.filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
	}, [users, filter])

	function replaceUser(updated: User) {
		setUsers((prev) => prev?.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)) ?? null)
	}

	async function patchUser(id: number, patch: Partial<Pick<User, 'role' | 'status'>>) {
		setBusyId(id)
		setError(null)
		try {
			const updated = await api.patch<User>(`/admin/users/${id}`, patch)
			// se il backend risponde senza body si applica la modifica in locale
			replaceUser({ ...(users?.find((u) => u.id === id) as User), ...patch, ...(updated ?? {}) })
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Modifica non riuscita.')
		} finally {
			setBusyId(null)
		}
	}

	async function deleteUser(u: User) {
		if (!confirm(`Eliminare definitivamente l'utente "${u.username}"? L'azione non è reversibile.`)) return
		setBusyId(u.id)
		setError(null)
		try {
			await api.delete(`/admin/users/${u.id}`)
			setUsers((prev) => prev?.filter((x) => x.id !== u.id) ?? null)
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Eliminazione non riuscita.')
		} finally {
			setBusyId(null)
		}
	}

	return (
		<div>
			<div className="flex flex-wrap items-center gap-3">
				<input
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					placeholder="Filtra per username o email…"
					aria-label="Filtra utenti"
					className={`${inputClass} w-full max-w-xs`}
				/>
				<button
					onClick={() => setCreating(true)}
					className="ml-auto rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
				>
					+ Nuovo utente
				</button>
			</div>

			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{users === null && <p className="mt-6 text-[var(--wc-text-muted)]">Caricamento…</p>}
			{users && visible.length === 0 && !error && (
				<p className="mt-6 text-[var(--wc-text-muted)]">Nessun utente trovato.</p>
			)}

			{visible.length > 0 && (
				<div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--wc-border)]">
					<table className="w-full min-w-[760px] border-collapse text-sm">
						<thead>
							<tr className="bg-[var(--wc-surface)] text-left text-[var(--wc-text-muted)]">
								<th className="p-3">Utente</th>
								<th className="p-3">Ruolo</th>
								<th className="p-3">Stato</th>
								<th className="p-3 text-right">Azioni</th>
							</tr>
						</thead>
						<tbody>
							{visible.map((u) => {
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
														{isSelf && <span className="ml-1 text-xs text-[var(--wc-text-muted)]">(tu)</span>}
													</span>
													<span className="block text-xs text-[var(--wc-text-muted)]">{u.email}</span>
												</span>
											</Link>
										</td>
										<td className="p-3">
											<select
												value={u.role}
												disabled={isSelf || busyId === u.id}
												onChange={(e) => patchUser(u.id, { role: e.target.value as UserRole })}
												aria-label={`Ruolo di ${u.username}`}
												className={`${inputClass} py-1.5 disabled:opacity-50`}
											>
												<option value="user">Utente</option>
												<option value="admin">Admin</option>
											</select>
										</td>
										<td className="p-3">
											<span className={`font-medium ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
										</td>
										<td className="p-3">
											<div className="flex flex-wrap items-center justify-end gap-2">
												<button
													onClick={() => setEditing(u)}
													className="rounded-full border border-[var(--wc-border)] px-3 py-1 hover:border-[var(--wc-basil)]"
												>
													Modifica
												</button>
												{status === 'active' ? (
													<>
														<button
															disabled={isSelf || busyId === u.id}
															onClick={() => patchUser(u.id, { status: 'disabled' })}
															className="rounded-full border border-[var(--wc-border)] px-3 py-1 hover:border-[var(--wc-saffron)] disabled:opacity-40"
														>
															Disattiva
														</button>
														<button
															disabled={isSelf || busyId === u.id}
															onClick={() => {
																if (confirm(`Bannare "${u.username}"?`)) patchUser(u.id, { status: 'banned' })
															}}
															className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-40"
														>
															Banna
														</button>
													</>
												) : (
													<button
														disabled={busyId === u.id}
														onClick={() => patchUser(u.id, { status: 'active' })}
														className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-[var(--wc-basil)] hover:border-[var(--wc-basil)] disabled:opacity-40"
													>
														Riattiva
													</button>
												)}
												<button
													disabled={isSelf || busyId === u.id}
													onClick={() => deleteUser(u)}
													className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-40"
												>
													Elimina
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

			{editing && (
				<UserDialog
					title={`Modifica ${editing.username}`}
					initial={editing}
					onClose={() => setEditing(null)}
					onSaved={(saved) => {
						replaceUser(saved)
						setEditing(null)
					}}
				/>
			)}
			{creating && (
				<UserDialog
					title="Nuovo utente"
					onClose={() => setCreating(false)}
					onSaved={(created) => {
						setUsers((prev) => [created, ...(prev ?? [])])
						setCreating(false)
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
			setError(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.')
			setSubmitting(false)
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose()
			}}
		>
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6"
			>
				<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{title}</h2>
				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Username</label>
					<input required value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputClass} w-full`} />
				</div>
				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Email</label>
					<input
						required
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className={`${inputClass} w-full`}
					/>
				</div>
				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Password</label>
					<input
						type="password"
						required={!initial}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder={initial ? 'Lascia vuoto per non modificarla' : ''}
						className={`${inputClass} w-full`}
					/>
				</div>
				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Ruolo</label>
					<select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={`${inputClass} w-full`}>
						<option value="user">Utente</option>
						<option value="admin">Admin</option>
					</select>
				</div>
				{error && <p className="text-sm text-[var(--wc-paprika)]">{error}</p>}
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-full border border-[var(--wc-border)] px-4 py-2 text-sm hover:border-[var(--wc-basil)]"
					>
						Annulla
					</button>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
					>
						{submitting ? 'Salvataggio…' : 'Salva'}
					</button>
				</div>
			</form>
		</div>
	)
}

export default AdminUsers
