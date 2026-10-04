import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Recipe } from '../types/models'

type RecipeOption = Pick<Recipe, 'id' | 'title'>

interface RecipeAutocompleteProps {
	recipes: RecipeOption[]
	// ricetta attualmente assegnata alla cella (se presente)
	selected?: RecipeOption | null
	disabled?: boolean
	onSelect: (recipeId: number | null) => void
}

const MAX_OPTIONS = 6

// box testuale con suggerimenti: sostituisce la <select> con l'elenco di tutte le ricette
function RecipeAutocomplete({ recipes, selected, disabled, onSelect }: RecipeAutocompleteProps) {
	const selectedTitle = selected?.title ?? ''
	const [text, setText] = useState(selectedTitle)
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)
	const [rect, setRect] = useState<DOMRect | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// riallinea il testo quando la ricetta assegnata cambia dall'esterno (cambio settimana, salvataggio…):
	// aggiornamento durante il render, pattern raccomandato da React al posto di un effect
	const [prevSelectedTitle, setPrevSelectedTitle] = useState(selectedTitle)
	if (prevSelectedTitle !== selectedTitle) {
		setPrevSelectedTitle(selectedTitle)
		setText(selectedTitle)
	}

	const options = useMemo(() => {
		const q = text.trim().toLowerCase()
		if (!q || q === selectedTitle.toLowerCase()) return recipes.slice(0, MAX_OPTIONS)
		return recipes.filter((r) => r.title.toLowerCase().includes(q)).slice(0, MAX_OPTIONS)
	}, [text, recipes, selectedTitle])

	function openList() {
		// il dropdown è position:fixed perché la tabella ha overflow-x:auto e lo taglierebbe
		if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
		setActiveIndex(0)
		setOpen(true)
	}

	function choose(recipe: RecipeOption) {
		setText(recipe.title)
		setOpen(false)
		if (recipe.id !== selected?.id) onSelect(recipe.id)
	}

	function commitOnBlur() {
		setOpen(false)
		const value = text.trim()
		if (!value) {
			setText('')
			if (selected) onSelect(null)
			return
		}
		const exact = recipes.find((r) => r.title.toLowerCase() === value.toLowerCase())
		if (exact) {
			choose(exact)
		} else {
			// testo che non corrisponde a nessuna ricetta: si torna al valore precedente
			setText(selectedTitle)
		}
	}

	function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			if (!open) openList()
			else setActiveIndex((i) => (options.length ? (i + 1) % options.length : 0))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : 0))
		} else if (e.key === 'Enter') {
			e.preventDefault()
			if (open && options[activeIndex]) choose(options[activeIndex])
			else inputRef.current?.blur()
		} else if (e.key === 'Escape') {
			setText(selectedTitle)
			setOpen(false)
		}
	}

	return (
		<>
			<input
				ref={inputRef}
				type="text"
				value={text}
				disabled={disabled}
				placeholder="Scrivi una ricetta…"
				aria-label="Ricetta"
				aria-autocomplete="list"
				autoComplete="off"
				onChange={(e) => {
					setText(e.target.value)
					openList()
				}}
				onFocus={openList}
				onBlur={commitOnBlur}
				onKeyDown={handleKeyDown}
				className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2 py-1.5 text-xs text-[var(--wc-text)] outline-none placeholder:text-[var(--wc-text-muted)] focus:border-[var(--wc-basil)] disabled:opacity-50"
			/>
			{open && rect && options.length > 0 && (
				<ul
					role="listbox"
					style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: Math.max(rect.width, 180) }}
					className="z-50 overflow-hidden rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-lg"
				>
					{options.map((r, index) => (
						<li key={r.id} role="option" aria-selected={index === activeIndex}>
							{/* onMouseDown + preventDefault: la scelta avviene prima del blur dell'input */}
							<button
								type="button"
								onMouseDown={(e) => {
									e.preventDefault()
									choose(r)
								}}
								onMouseEnter={() => setActiveIndex(index)}
								className={`block w-full truncate px-3 py-2 text-left text-xs text-[var(--wc-text)] ${
									index === activeIndex ? 'bg-[var(--wc-surface-raised)]' : ''
								}`}
							>
								{r.title}
							</button>
						</li>
					))}
				</ul>
			)}
		</>
	)
}

export default RecipeAutocomplete
