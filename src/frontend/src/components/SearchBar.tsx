import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Recipe } from '../types/models'

interface SearchBarProps {
	className?: string
	placeholder?: string
}

const MIN_CHARS = 2
const MAX_SUGGESTIONS = 5
const DEBOUNCE_MS = 250

type Suggestion = Pick<Recipe, 'id' | 'title'>

function SearchBar({ className = '', placeholder = 'Cerca una ricetta…' }: SearchBarProps) {
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
			api
				.get<Suggestion[]>(`/recipes/search?value=${encodeURIComponent(trimmed)}`, {
					signal: controller.signal,
					retryOnUnauthorized: false,
				})
				.then((data) => {
					setSuggestions(data.slice(0, MAX_SUGGESTIONS))
					setActiveIndex(-1)
				})
				.catch(() => {
					// i suggerimenti sono un extra: se falliscono non si mostra nessun errore
				})
		}, DEBOUNCE_MS)

		return () => {
			clearTimeout(timer)
			controller.abort()
		}
	}, [trimmed])

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

	function goToRecipe(id: number) {
		navigate(`/recipes/${id}`)
		reset()
	}

	function handleSubmit(e: FormEvent) {
		e.preventDefault()
		if (showList && activeIndex >= 0) {
			goToRecipe(suggestions[activeIndex].id)
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
				placeholder={placeholder}
				aria-label="Cerca ricette"
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
				Cerca
			</button>

			{showList && (
				<ul
					id="search-suggestions"
					role="listbox"
					className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-lg"
				>
					{suggestions.map((s, index) => (
						<li key={s.id} role="option" aria-selected={index === activeIndex}>
							<button
								type="button"
								onMouseEnter={() => setActiveIndex(index)}
								onClick={() => goToRecipe(s.id)}
								className={`block w-full truncate px-4 py-2 text-left text-sm text-[var(--wc-text)] ${
									index === activeIndex ? 'bg-[var(--wc-surface-raised)]' : ''
								}`}
							>
								{s.title}
							</button>
						</li>
					))}
				</ul>
			)}
		</form>
	)
}

export default SearchBar
