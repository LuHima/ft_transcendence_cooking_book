import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'

function field(value: string | null | undefined) {
	return value ?? ''
}

function Anagrafica() {
	const { user, refreshUser } = useAuth()
	const [form, setForm] = useState({
		first_name: field(user?.first_name),
		last_name: field(user?.last_name),
		birth_date: field(user?.birth_date?.slice(0, 10)),
		phone: field(user?.phone),
		address: field(user?.address),
		city: field(user?.city),
		postal_code: field(user?.postal_code),
	})
	const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
	const [error, setError] = useState<string | null>(null)

	if (!user) return null

	function update<K extends keyof typeof form>(key: K, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }))
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setStatus('saving')
		setError(null)
		try {
			await api.patch('/users/me', form)
			await refreshUser()
			setStatus('saved')
		} catch (err) {
			setStatus('error')
			setError(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.')
		}
	}

	return (
		<div className="mx-auto max-w-xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">Anagrafica</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">
				Questi dati sono facoltativi e restano visibili solo a te.
			</p>

			<form onSubmit={handleSubmit} className="mt-8 space-y-5">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Nome</label>
						<input
							value={form.first_name}
							onChange={(e) => update('first_name', e.target.value)}
							className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Cognome</label>
						<input
							value={form.last_name}
							onChange={(e) => update('last_name', e.target.value)}
							className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
						/>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Data di nascita</label>
					<input
						type="date"
						value={form.birth_date}
						onChange={(e) => update('birth_date', e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>

				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Telefono</label>
					<input
						value={form.phone}
						onChange={(e) => update('phone', e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>

				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Indirizzo</label>
					<input
						value={form.address}
						onChange={(e) => update('address', e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Città</label>
						<input
							value={form.city}
							onChange={(e) => update('city', e.target.value)}
							className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">CAP</label>
						<input
							value={form.postal_code}
							onChange={(e) => update('postal_code', e.target.value)}
							className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
						/>
					</div>
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

export default Anagrafica
