import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function NotFound() {
	const { t } = useTranslation()
	return (
		<div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
			<h1 className="font-display text-5xl text-[var(--wc-saffron)]">404</h1>
			<p className="mt-3 text-[var(--wc-text-muted)]">{t('notFound.text')}</p>
			<Link to="/" className="mt-6 text-[var(--wc-basil)] hover:underline">
				{t('notFound.home')}
			</Link>
		</div>
	)
}

export default NotFound
