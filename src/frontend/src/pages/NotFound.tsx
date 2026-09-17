import { Link } from 'react-router-dom'

function NotFound() {
	return (
		<div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
			<h1 className="font-display text-5xl text-[var(--wc-saffron)]">404</h1>
			<p className="mt-3 text-[var(--wc-text-muted)]">Questa pagina non esiste, o la ricetta è stata rimossa.</p>
			<Link to="/" className="mt-6 text-[var(--wc-basil)] hover:underline">
				Torna alla home
			</Link>
		</div>
	)
}

export default NotFound
