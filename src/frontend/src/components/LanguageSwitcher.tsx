import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS } from '../i18n'
import { useLang } from '../lib/useLang'
import Flag from './Flag'
import type { Lang } from '../types/models'

const CODES: Record<Lang, string> = { it: 'IT', en: 'EN', fr: 'FR' }

// selettore della lingua dell'interfaccia (bandiera + sigla); la scelta è salvata in localStorage da i18next.
// variant "compact" = barra in alto; "field" = campo a tutta larghezza (profilo). Mostra solo bandierina + sigla (IT, EN, FR).
function LanguageSwitcher({ variant = 'compact', id }: { variant?: 'compact' | 'field'; id?: string }) {
	const { t, i18n } = useTranslation()
	const lang = useLang()
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const onDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false)
		}
		document.addEventListener('mousedown', onDown)
		document.addEventListener('keydown', onKey)
		return () => {
			document.removeEventListener('mousedown', onDown)
			document.removeEventListener('keydown', onKey)
		}
	}, [open])

	const field = variant === 'field'
	const label = (l: Lang) => CODES[l]

	return (
		// nei menu stretti (< md) il pannello si ancora all'header e occupa la larghezza della pagina: non esce dallo schermo
		<div ref={ref} className={`${field ? 'relative' : 'md:relative'} shrink-0`}>
			<button
				id={id}
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-label={t('common.language')}
				className={
					field
						? 'flex h-[42px] w-full items-center gap-2 rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 text-left outline-none hover:border-[var(--wc-basil)] focus:border-[var(--wc-basil)]'
						: 'flex h-9 items-center gap-1.5 rounded-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2.5 text-sm text-[var(--wc-text)] hover:border-[var(--wc-basil)]'
				}
			>
				<Flag lang={lang} />
				<span className={field ? 'flex-1' : ''}>{label(lang)}</span>
				<span aria-hidden="true" className="text-xs text-[var(--wc-text-muted)]">▾</span>
			</button>
			{open && (
				<ul
					role="listbox"
					className={
						field
							? 'absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] py-1 shadow-lg'
							: 'absolute inset-x-2 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] py-1 shadow-lg md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-36'
					}
				>
					{SUPPORTED_LANGS.map((l) => (
						<li key={l} role="option" aria-selected={l === lang}>
							<button
								type="button"
								onClick={() => {
									void i18n.changeLanguage(l)
									setOpen(false)
								}}
								className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--wc-surface-raised)] ${l === lang ? 'text-[var(--wc-saffron)]' : 'text-[var(--wc-text)]'}`}
							>
								<Flag lang={l} />
								{CODES[l]}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

export default LanguageSwitcher
