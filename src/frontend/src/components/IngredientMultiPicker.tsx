import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CatalogIngredient } from '../types/models'

interface IngredientMultiPickerProps {
	label: string
	catalog: CatalogIngredient[]
	selectedIds: number[]
	// IDs already used in the other list: the backend rejects overlapping include/exclude sets
	disabledIds?: number[]
	onChange: (ids: number[]) => void
	tone?: 'include' | 'exclude'
}

const MAX_OPTIONS = 8

// Multi-select over the ingredient catalog, with text search and removable chips
function IngredientMultiPicker({ label, catalog, selectedIds, disabledIds = [], onChange, tone = 'include' }: IngredientMultiPickerProps) {
	const { t } = useTranslation()
	const listId = useId()
	const inputId = useId()
	const [text, setText] = useState('')
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)

	const byId = useMemo(() => new Map(catalog.map((i) => [i.id, i])), [catalog])
	const options = useMemo(() => {
		const q = text.trim().toLowerCase()
		const blocked = new Set([...selectedIds, ...disabledIds])
		return catalog
			.filter((i) => !blocked.has(i.id) && (!q || i.name.toLowerCase().includes(q) || i.slug.includes(q)))
			.slice(0, MAX_OPTIONS)
	}, [text, catalog, selectedIds, disabledIds])

	function add(i: CatalogIngredient) {
		onChange([...selectedIds, i.id])
		setText('')
		setActiveIndex(0)
	}

	function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setOpen(true)
			setActiveIndex((i) => Math.min(i + 1, options.length - 1))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => Math.max(i - 1, 0))
		} else if (e.key === 'Enter') {
			if (open && options[activeIndex]) {
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
								aria-label={t('search.removeItem', { name: byId.get(id)?.name ?? `#${id}` })}
								className={`rounded-full border px-2.5 py-0.5 text-sm ${chip}`}
							>
								{tone === 'exclude' ? '− ' : ''}
								{byId.get(id)?.name ?? `#${id}`} ×
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
					aria-expanded={open && options.length > 0}
					aria-controls={listId}
					aria-autocomplete="list"
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
				{open && options.length > 0 && (
					<ul
						id={listId}
						role="listbox"
						className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-lg"
					>
						{options.map((i, index) => (
							<li key={i.id} role="option" aria-selected={index === activeIndex}>
								<button
									type="button"
									// onMouseDown: select before the input blur closes the list
									onMouseDown={(e) => {
										e.preventDefault()
										add(i)
									}}
									onMouseEnter={() => setActiveIndex(index)}
									className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-[var(--wc-text)] ${
										index === activeIndex ? 'bg-[var(--wc-surface-raised)]' : ''
									}`}
								>
									<span className="truncate">{i.name}</span>
									<span className="shrink-0 text-[10px] text-[var(--wc-text-muted)]">{t(`ingredientCategory.${i.category}`)}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	)
}

export default IngredientMultiPicker
