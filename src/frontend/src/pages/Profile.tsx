import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'

function Profile() {
	const { user, refreshUser } = useAuth()
	const [username, setUsername] = useState(user?.username ?? '')
	const [email, setEmail] = useState(user?.email ?? '')
	const [password, setPassword] = useState('')
	const [avatarFile, setAvatarFile] = useState<File | null>(null)
	const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
	const [error, setError] = useState<string | null>(null)

	if (!user) return null

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setStatus('saving')
		setError(null)
		try {
			if (avatarFile) {
				const formData = new FormData()
				formData.append('avatar', avatarFile)
				await api.patch('/users/me/avatar', formData)
			}
			await api.patch('/users/me', {
				username,
				email,
				...(password ? { password } : {}),
			})
			await refreshUser()
			setPassword('')
			setStatus('saved')
		} catch (err) {
			setStatus('error')
			setError(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.')
		}
	}

	return (
		<div className="mx-auto max-w-xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">Profilo</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">Gestisci le informazioni del tuo account.</p>

			<form onSubmit={handleSubmit} className="mt-8 space-y-5">
				<div className="flex items-center gap-4">
					{user.avatar_url ? (
						<img src={user.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
					) : (
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wc-basil)] text-xl font-semibold text-[var(--wc-bg)]">
							{user.username.charAt(0).toUpperCase()}
						</div>
					)}
					<div>
						<label htmlFor="avatar" className="block text-sm text-[var(--wc-text-muted)]">
							Cambia foto profilo
						</label>
						<input
							id="avatar"
							type="file"
							accept="image/*"
							onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
							className="mt-1 text-sm text-[var(--wc-text-muted)]"
						/>
					</div>
				</div>

				<div>
					<label htmlFor="username" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						Username
					</label>
					<input
						id="username"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>

				<div>
					<label htmlFor="email" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						Email
					</label>
					<input
						id="email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>

				<div>
					<label htmlFor="password" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						Nuova password
					</label>
					<input
						id="password"
						type="password"
						placeholder="Lascia vuoto per non modificarla"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>

				{status === 'error' && <p className="text-sm text-[var(--wc-paprika)]">{error}</p>}
				{status === 'saved' && <p className="text-sm text-[var(--wc-basil)]">Modifiche salvate.</p>}

				<button
					type="submit"
					disabled={status === 'saving'}
					className="rounded-full bg-[var(--wc-basil)] px-6 py-2.5 font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
				>
					{status === 'saving' ? 'Salvataggio…' : 'Salva modifiche'}
				</button>
			</form>
		</div>
	)
}

export default Profile
