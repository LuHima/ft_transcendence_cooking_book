import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, asArray, qs } from '../api/client'
import { useLang } from '../lib/useLang'
import type { Paginated, RecipeSummary, UserSearchResult } from '../types/models'

interface SearchBarProps {
	className?: string
	placeholder?: string
}

const MIN_CHARS = 2
const MAX_RECIPES = 4
const MAX_USERS = 3
const DEBOUNCE_MS = 250

interface Suggestion {
	kind: 'recipe' | 'user'
	// gli utenti per ora possono arrivare senza id (GET /users?search= restituisce solo username)
	id?: number
	label: string
}

function SearchBar({ className = '', placeholder }: SearchBarProps) {
	const { t } = useTranslation()
	const lang = useLang()
	const navigate = useNavigate()
	const [value, setValue] = useState('')
	const [suggestions, setSuggestions] = useState<Suggestion[]>([])
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(-1)
	const containerRef = useRef<HTMLFormElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	const trimmed = value.trim()
	const showList = open && trimmed.length >= MIN_CHARS && suggestions.length > 0

	// suggerimenti: stessa rotta della ricerca, con debounce e annullamento delle richieste superate
	useEffect(() => {
		if (trimmed.length < MIN_CHARS) return

		const controller = new AbortController()
		const timer = setTimeout(() => {
			const opts = { signal: controller.signal, retryOnUnauthorized: false }
			// ricette e utenti in parallelo; se una delle due fallisce si mostra comunque l'altra
			Promise.allSettled([
				api.get<Paginated<RecipeSummary>>(
					`/recipes${qs({ search: trimmed, limit: MAX_RECIPES, lang })}`,
					opts,
				),
				api.get<UserSearchResult[]>(`/users${qs({ search: trimmed })}`, opts),
			]).then(([recipes, users]) => {
				if (controller.signal.aborted) return
				const list: Suggestion[] = [
					...(recipes.status === 'fulfilled' ? (recipes.value?.items ?? []) : [])
						.slice(0, MAX_RECIPES)
						.map((r) => ({ kind: 'recipe' as const, id: r.id, label: r.title })),
					...asArray<UserSearchResult>(users.status === 'fulfilled' ? users.value : [])
						.slice(0, MAX_USERS)
						.map((u) => ({ kind: 'user' as const, id: u.id, label: u.username })),
				]
				setSuggestions(list)
				setActiveIndex(-1)
			})
		}, DEBOUNCE_MS)

		return () => {
			clearTimeout(timer)
			controller.abort()
		}
	}, [trimmed, lang])

	// chiude la lista cliccando fuori dalla barra
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	function reset() {
		setValue('')
		setSuggestions([])
		setActiveIndex(-1)
		setOpen(false)
		inputRef.current?.blur()
	}

	function goTo(s: Suggestion) {
		if (s.id == null) navigate(`/search?q=${encodeURIComponent(s.label)}`)
		else navigate(s.kind === 'user' ? `/users/${s.id}` : `/recipes/${s.id}`)
		reset()
	}

	function handleSubmit(e: FormEvent) {
		e.preventDefault()
		if (showList && activeIndex >= 0) {
			goTo(suggestions[activeIndex])
			return
		}
		if (!trimmed) return
		navigate(`/search?q=${encodeURIComponent(trimmed)}`)
		reset()
	}

	function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Escape') {
			setOpen(false)
			return
		}
		if (!showList) return
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setActiveIndex((i) => (i + 1) % suggestions.length)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
		}
	}

	return (
		<form
			ref={containerRef}
			onSubmit={handleSubmit}
			className={`relative flex items-center ${className}`}
			role="search"
		>
			<input
				ref={inputRef}
				type="search"
				value={value}
				onChange={(e) => {
					setValue(e.target.value)
					setOpen(true)
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder ?? t('search.placeholder')}
				aria-label={t('search.placeholder')}
				aria-autocomplete="list"
				aria-expanded={showList}
				aria-controls="search-suggestions"
				autoComplete="off"
				className="w-full rounded-l-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4 py-2 text-sm text-[var(--wc-text)] placeholder:text-[var(--wc-text-muted)] outline-none focus:border-[var(--wc-basil)]"
			/>
			<button
				type="submit"
				className="rounded-r-full border border-l-0 border-[var(--wc-border)] bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)]"
			>
				{t('search.button')}
			</button>

			{showList && (
				<ul
					id="search-suggestions"
					role="listbox"
					className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-lg"
				>
					{suggestions.map((s, index) => (
						<li key={`${s.kind}-${s.id ?? s.label}`} role="option" aria-selected={index === activeIndex}>
							<button
								type="button"
								onMouseEnter={() => setActiveIndex(index)}
								onClick={() => goTo(s)}
								className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm text-[var(--wc-text)] ${
									index === activeIndex ? 'bg-[var(--wc-surface-raised)]' : ''
								}`}
							>
								<span className="truncate">{s.kind === 'user' ? `@${s.label}` : s.label}</span>
								<span className="shrink-0 text-[10px] uppercase text-[var(--wc-text-muted)]">
									{s.kind === 'user' ? t('search.userLabel') : t('search.recipeLabel')}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</form>
	)
}

export default SearchBar
