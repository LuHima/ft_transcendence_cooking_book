import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLang } from '../lib/useLang'
import { useIngredientSearch } from '../lib/catalog'
import type { CatalogIngredient } from '../types/models'

interface IngredientMultiPickerProps {
	label: string
	selectedIds: number[]
	// Display names of the selected IDs (kept by the parent: chips survive new searches and URL reloads)
	names: ReadonlyMap<number, string>
	// IDs already used in the other list: the backend rejects overlapping include/exclude sets
	disabledIds?: number[]
	onChange: (ids: number[]) => void
	// Called with the picked ingredient so the parent can remember its name
	onPick?: (ingredient: CatalogIngredient) => void
	tone?: 'include' | 'exclude'
}

// Multi-select over the ingredient catalog (~3,000 items): debounced server-side search
// (GET /ingredients?search=&lang=&limit=20&sort_by=name), removable chips and on-demand next pages
function IngredientMultiPicker({ label, selectedIds, names, disabledIds = [], onChange, onPick, tone = 'include' }: IngredientMultiPickerProps) {
	const { t } = useTranslation()
	const lang = useLang()
	const listId = useId()
	const inputId = useId()
	const [text, setText] = useState('')
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)

	const { items, loading, error, hasMore, loadingMore, loadMore } = useIngredientSearch(text, lang, open)
	const options = useMemo(() => {
		const blocked = new Set([...selectedIds, ...disabledIds])
		return items.filter((i) => !blocked.has(i.id))
	}, [items, selectedIds, disabledIds])

	function add(i: CatalogIngredient) {
		onPick?.(i)
		onChange([...selectedIds, i.id])
		setText('')
		setActiveIndex(0)
	}

	function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setOpen(true)
			setActiveIndex((i) => Math.max(0, Math.min(i + 1, options.length - 1)))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => Math.max(i - 1, 0))
		} else if (e.key === 'Enter') {
			if (open && !loading && options[activeIndex]) {
				e.preventDefault()
				add(options[activeIndex])
			}
		} else if (e.key === 'Escape') {
			setOpen(false)
		} else if (e.key === 'Backspace' && !text && selectedIds.length > 0) {
			onChange(selectedIds.slice(0, -1))
		}
	}

	const chip =
		tone === 'exclude'
			? 'border-[var(--wc-paprika)] text-[var(--wc-paprika)]'
			: 'border-[var(--wc-basil)] bg-[var(--wc-basil)] text-[var(--wc-bg)]'
	const nameOf = (id: number) => names.get(id) ?? `#${id}`
	const status = loading ? t('common.loading') : error ? t('form.catalogUnavailable') : options.length === 0 ? t('form.noIngredientFound') : null

	return (
		<div className="text-xs text-[var(--wc-text-muted)]">
			<label htmlFor={inputId}>{label}</label>
			{selectedIds.length > 0 && (
				<ul className="mt-1 flex flex-wrap gap-1.5">
					{selectedIds.map((id) => (
						<li key={id}>
							<button
								type="button"
								onClick={() => onChange(selectedIds.filter((x) => x !== id))}
								aria-label={t('search.removeItem', { name: nameOf(id) })}
								className={`rounded-full border px-2.5 py-0.5 text-sm ${chip}`}
							>
								{tone === 'exclude' ? '− ' : ''}
								{nameOf(id)} ×
							</button>
						</li>
					))}
				</ul>
			)}
			<div className="relative mt-1">
				<input
					id={inputId}
					value={text}
					role="combobox"
					aria-expanded={open}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={open && !status && options[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined}
					aria-busy={open && loading}
					autoComplete="off"
					placeholder={t('form.ingredientPlaceholder')}
					onChange={(e) => {
						setText(e.target.value)
						setOpen(true)
						setActiveIndex(0)
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setOpen(false)}
					onKeyDown={handleKeyDown}
					className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]"
				/>
				{open && (
					<ul
						id={listId}
						role="listbox"
						className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-lg"
					>
						{status ? (
							<li role="status" className={`px-3 py-2 text-sm ${error ? 'text-[var(--wc-paprika)]' : 'text-[var(--wc-text-muted)]'}`}>
								{status}
							</li>
						) : (
							<>
								{options.map((i, index) => (
									<li
										key={i.id}
										id={`${listId}-opt-${index}`}
										role="option"
										aria-selected={index === activeIndex}
										tabIndex={-1}
										// onMouseDown: select before the input blur closes the list
										onMouseDown={(e) => {
											e.preventDefault()
											add(i)
										}}
										onMouseEnter={() => setActiveIndex(index)}
										className={`flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-sm text-[var(--wc-text)] ${
											index === activeIndex ? 'bg-[var(--wc-surface-raised)]' : ''
										}`}
									>
										<span className="truncate">{i.name}</span>
										<span className="shrink-0 text-[10px] text-[var(--wc-text-muted)]">{t(`ingredientCategory.${i.category}`)}</span>
									</li>
								))}
							</>
						)}
						{!loading && !error && hasMore && (
							<li role="presentation">
								<button
									type="button"
									disabled={loadingMore}
									onMouseDown={(e) => {
										e.preventDefault()
										void loadMore()
									}}
									className="w-full px-3 py-1.5 text-left text-xs text-[var(--wc-saffron)] hover:underline disabled:opacity-50"
								>
									{loadingMore ? t('common.loading') : t('form.moreIngredients')}
								</button>
							</li>
						)}
					</ul>
				)}
			</div>
		</div>
	)
}

export default IngredientMultiPicker
