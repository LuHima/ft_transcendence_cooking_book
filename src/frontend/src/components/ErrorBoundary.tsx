import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
	children: ReactNode
}

interface State {
	error: Error | null
}

// rete di sicurezza: se una pagina va in errore mostra un messaggio invece di una pagina bianca
class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null }

	static getDerivedStateFromError(error: Error): State {
		return { error }
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error('Errore di rendering:', error, info.componentStack)
	}

	render() {
		if (!this.state.error) return this.props.children
		return (
			<div className="mx-auto max-w-xl px-4 py-24 text-center">
				<h1 className="font-display text-3xl text-[var(--wc-paprika)]">Qualcosa è andato storto</h1>
				<p className="mt-3 text-[var(--wc-text-muted)]">
					Non è stato possibile mostrare questa pagina. Riprova o torna alla home.
				</p>
				<Link
					to="/"
					onClick={() => this.setState({ error: null })}
					className="mt-6 inline-block rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
				>
					Torna alla home
				</Link>
			</div>
		)
	}
}

export default ErrorBoundary
