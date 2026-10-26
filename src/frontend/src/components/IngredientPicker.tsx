import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CatalogIngredient } from '../types/models'

interface IngredientPickerProps {
	catalog: CatalogIngredient[]
	value: CatalogIngredient | null
	onChange: (ingredient: CatalogIngredient | null) => void
	invalid?: boolean
}

const MAX_OPTIONS = 8

// combobox sul catalogo ingredienti: il backend accetta solo ingredient_id presenti nel catalogo
function IngredientPicker({ catalog, value, onChange, invalid }: IngredientPickerProps) {
	const { t } = useTranslation()
	const listId = useId()
	const [text, setText] = useState(value?.name ?? '')
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)

	// riallinea il testo se il valore cambia dall'esterno (es. caricamento di una ricetta in modifica)
	const [prevValueId, setPrevValueId] = useState(value?.id ?? null)
	if ((value?.id ?? null) !== prevValueId) {
		setPrevValueId(value?.id ?? null)
		setText(value?.name ?? '')
	}

	const options = useMemo(() => {
		const q = text.trim().toLowerCase()
		if (!q || q === value?.name.toLowerCase()) return catalog.slice(0, MAX_OPTIONS)
		return catalog.filter((i) => i.name.toLowerCase().includes(q) || i.slug.includes(q)).slice(0, MAX_OPTIONS)
	}, [text, catalog, value])

	function choose(ingredient: CatalogIngredient) {
		setText(ingredient.name)
		setOpen(false)
		onChange(ingredient)
	}

	function handleBlur() {
		setOpen(false)
		const q = text.trim().toLowerCase()
		const exact = catalog.find((i) => i.name.toLowerCase() === q)
		if (exact) {
			if (exact.id !== value?.id) onChange(exact)
			setText(exact.name)
		} else if (value) {
			// testo che non corrisponde a nessun ingrediente: si torna alla scelta precedente
			setText(value.name)
		} else {
			setText('')
		}
	}

	function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setOpen(true)
			setActiveIndex((i) => (options.length ? (i + 1) % options.length : 0))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : 0))
		} else if (e.key === 'Enter' && open && options[activeIndex]) {
			e.preventDefault()
			choose(options[activeIndex])
		} else if (e.key === 'Escape') {
			setOpen(false)
		}
	}

	return (
		<div className="relative min-w-[12rem] flex-1 basis-full sm:basis-0">
			<input
				type="text"
				value={text}
				placeholder={t('form.ingredientPlaceholder')}
				aria-label={t('form.ingredientName')}
				aria-autocomplete="list"
				aria-expanded={open}
				aria-controls={listId}
				aria-invalid={invalid || undefined}
				autoComplete="off"
				onChange={(e) => {
					setText(e.target.value)
					setActiveIndex(0)
					setOpen(true)
					if (value) onChange(null)
				}}
				onFocus={() => setOpen(true)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				className={`h-[42px] w-full rounded-lg border bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)] ${
					invalid ? 'border-[var(--wc-paprika)]' : 'border-[var(--wc-border)]'
				}`}
			/>
			{open && (
				<ul
					id={listId}
					role="listbox"
					className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-lg"
				>
					{options.length === 0 ? (
						<li className="px-3 py-2 text-sm text-[var(--wc-text-muted)]">{t('form.noIngredientFound')}</li>
					) : (
						options.map((i, index) => (
							<li key={i.id} role="option" aria-selected={index === activeIndex}>
								{/* onMouseDown + preventDefault: la scelta avviene prima del blur dell'input */}
								<button
									type="button"
									onMouseDown={(e) => {
										e.preventDefault()
										choose(i)
									}}
									onMouseEnter={() => setActiveIndex(index)}
									className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[var(--wc-text)] ${
										index === activeIndex ? 'bg-[var(--wc-surface-raised)]' : ''
									}`}
								>
									<span className="truncate">{i.name}</span>
									<span className="shrink-0 text-[10px] uppercase text-[var(--wc-text-muted)]">
										{t(`ingredientCategory.${i.category}`)}
									</span>
								</button>
							</li>
						))
					)}
				</ul>
			)}
		</div>
	)
}

export default IngredientPicker
