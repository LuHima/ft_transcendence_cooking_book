import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'

function Register() {
	const { signUp } = useAuth()
	const navigate = useNavigate()

	const [username, setUsername] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setError(null)
		setSubmitting(true)
		try {
			await signUp({ username, email, password })
			navigate('/login', { state: { registered: true } })
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Registrazione non riuscita, riprova.')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">Crea il tuo account</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">Inizia a raccogliere le tue ricette.</p>

			<form onSubmit={handleSubmit} className="mt-8 space-y-4">
				<div>
					<label htmlFor="username" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						Username
					</label>
					<input
						id="username"
						type="text"
						required
						minLength={3}
						maxLength={30}
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
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>
				<div>
					<label htmlFor="password" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						Password
					</label>
					<input
						id="password"
						type="password"
						required
						minLength={9}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
					<p className="mt-1 text-xs text-[var(--wc-text-muted)]">
						Almeno 9 caratteri, con maiuscola, minuscola e un numero o simbolo.
					</p>
				</div>

				{error && <p className="text-sm text-[var(--wc-paprika)]">{error}</p>}

				<button
					type="submit"
					disabled={submitting}
					className="w-full rounded-full bg-[var(--wc-basil)] py-2.5 font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
				>
					{submitting ? 'Creazione in corso…' : 'Registrati'}
				</button>
			</form>

			<p className="mt-6 text-sm text-[var(--wc-text-muted)]">
				Hai già un account?{' '}
				<Link to="/login" className="text-[var(--wc-saffron)] hover:underline">
					Accedi
				</Link>
			</p>
		</div>
	)
}

export default Register
