import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLang } from '../lib/useLang'
import { useIngredientSearch } from '../lib/catalog'
import type { CatalogIngredient } from '../types/models'

interface IngredientPickerProps {
	value: CatalogIngredient | null
	onChange: (ingredient: CatalogIngredient | null) => void
	invalid?: boolean
}

// Combobox over the ingredient catalog (~3,000 items): debounced server-side search on
// GET /ingredients?search=&lang=&limit=20&sort_by=name, with on-demand next pages.
// The backend only accepts catalog ingredient IDs; the selected value keeps its own name,
// so an existing recipe shows its ingredients without loading the catalog.
function IngredientPicker({ value, onChange, invalid }: IngredientPickerProps) {
	const { t } = useTranslation()
	const lang = useLang()
	const listId = useId()
	const [text, setText] = useState(value?.name ?? '')
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)

	// Sync the text when the value changes from outside (e.g. loading a recipe to edit)
	const [prevValueId, setPrevValueId] = useState(value?.id ?? null)
	if ((value?.id ?? null) !== prevValueId) {
		setPrevValueId(value?.id ?? null)
		setText(value?.name ?? '')
	}

	// The current choice's name in the box means "browse": show the top of the list instead of searching for it
	const searchText = value && text === value.name ? '' : text
	const { items: options, loading, error, hasMore, loadingMore, loadMore } = useIngredientSearch(searchText, lang, open)

	function choose(ingredient: CatalogIngredient) {
		setText(ingredient.name)
		setOpen(false)
		onChange(ingredient)
	}

	function handleBlur() {
		setOpen(false)
		const q = text.trim().toLowerCase()
		const exact = q ? options.find((i) => i.name.toLowerCase() === q) : undefined
		if (exact) {
			if (exact.id !== value?.id) onChange(exact)
			setText(exact.name)
		} else if (value) {
			// Text matching no ingredient: revert to the previous choice
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
		} else if (e.key === 'Enter' && open && !loading && options[activeIndex]) {
			e.preventDefault()
			choose(options[activeIndex])
		} else if (e.key === 'Escape') {
			setOpen(false)
		}
	}

	const status = loading ? t('common.loading') : error ? t('form.catalogUnavailable') : options.length === 0 ? t('form.noIngredientFound') : null

	return (
		<div className="relative min-w-[12rem] flex-1 basis-full sm:basis-0">
			<input
				type="text"
				role="combobox"
				value={text}
				placeholder={t('form.ingredientPlaceholder')}
				aria-label={t('form.ingredientName')}
				aria-autocomplete="list"
				aria-expanded={open}
				aria-controls={listId}
				aria-busy={open && loading}
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
					{status ? (
						<li role="status" className={`px-3 py-2 text-sm ${error ? 'text-[var(--wc-paprika)]' : 'text-[var(--wc-text-muted)]'}`}>
							{status}
						</li>
					) : (
						<>
							{options.map((i, index) => (
								<li key={i.id} role="option" aria-selected={index === activeIndex}>
									{/* onMouseDown + preventDefault: select before the input blur */}
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
							))}
							{hasMore && (
								<li role="presentation">
									<button
										type="button"
										disabled={loadingMore}
										onMouseDown={(e) => {
											e.preventDefault()
											void loadMore()
										}}
										className="w-full px-3 py-2 text-left text-xs text-[var(--wc-saffron)] hover:underline disabled:opacity-50"
									>
										{loadingMore ? t('common.loading') : t('form.moreIngredients')}
									</button>
								</li>
							)}
						</>
					)}
				</ul>
			)}
		</div>
	)
}

export default IngredientPicker
