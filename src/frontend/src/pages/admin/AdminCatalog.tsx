import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api, ApiError, getErrorMessage, qs, toPage } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../lib/useLang'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { ListSkeleton } from '../../components/Skeleton'
import type {
	AdminCatalogSortBy,
	CatalogTranslations,
	CreateIngredientDto,
	CreateTagDto,
	IngredientCategory,
	IngredientDetailResponseDto,
	Lang,
	Paginated,
	SortOrder,
	TagDetailResponseDto,
	UpdateIngredientDto,
	UpdateTagDto,
} from '../../types/models'

// gestione del catalogo multilingua (solo admin), namespace /api/admin/catalog (ADR 0031):
//   elenchi (paginati):  GET    /admin/catalog/ingredients?page=&limit=&search=&category=&sort_by=id|slug&sort_order=asc|desc
//                        GET    /admin/catalog/tags?page=&limit=&search=&sort_by=id|slug&sort_order=asc|desc
//                        → { items, total, page, limit, total_pages, has_next_page, has_prev_page }, ogni riga con tutte le traduzioni
//   creazione:           POST   /admin/catalog/ingredients                POST   /admin/catalog/tags
//   modifica:            PATCH  /admin/catalog/ingredients/:id            PATCH  /admin/catalog/tags/:id   → solo translations
//   eliminazione:        DELETE /admin/catalog/ingredients/:id            DELETE /admin/catalog/tags/:id   → 409 se usati in ricette
const ADMIN_CATALOG = '/admin/catalog'
const PAGE_SIZE = 25

type Kind = 'ingredients' | 'tags'

const LANGS: Lang[] = ['it', 'en', 'fr']
const CATEGORIES: IngredientCategory[] = [
	'produce',
	'dairy_eggs',
	'meat_poultry',
	'seafood',
	'bakery_grains',
	'pantry_spices',
	'legumes_nuts',
	'beverages_liquids',
	'other',
]
const SORT_OPTIONS = ['id:asc', 'id:desc', 'slug:asc', 'slug:desc'] as const
type SortOption = (typeof SORT_OPTIONS)[number]
const DEFAULT_SORT: SortOption = 'id:asc'
const SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/
const SLUG_MAX: Record<Kind, number> = { ingredients: 100, tags: 50 }
const EMPTY_TRANSLATIONS: CatalogTranslations = { it: '', en: '', fr: '' }

// riga degli elenchi admin: tutte le traduzioni { it, en, fr } (category solo per gli ingredienti)
type CatalogRow = IngredientDetailResponseDto | (TagDetailResponseDto & { category?: undefined })

// nome nella lingua dell'interfaccia, con ripiego su inglese / prima traduzione disponibile
function displayName(row: CatalogRow, lang: Lang): { name: string; fallbackLang: Lang | null } {
	const tr = row.translations ?? EMPTY_TRANSLATIONS
	if (tr[lang]?.trim()) return { name: tr[lang], fallbackLang: null }
	const other = (['en', ...LANGS] as Lang[]).find((l) => tr[l]?.trim())
	return other ? { name: tr[other], fallbackLang: other } : { name: row.slug, fallbackLang: null }
}

const INPUT =
	'w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)] disabled:opacity-60'
const BTN_OUTLINE = 'rounded-full border border-[var(--wc-border)] px-3 py-1 text-sm hover:border-[var(--wc-basil)]'

function AdminCatalog() {
	const { t } = useTranslation()
	const [kind, setKind] = useState<Kind>('ingredients')

	return (
		<div>
			<div role="tablist" aria-label={t('admin.catalog.title')} className="inline-flex overflow-hidden rounded-full border border-[var(--wc-border)] text-sm">
				{(['ingredients', 'tags'] as const).map((k) => (
					<button
						key={k}
						role="tab"
						aria-selected={kind === k}
						onClick={() => setKind(k)}
						className={`px-4 py-1.5 ${kind === k ? 'bg-[var(--wc-basil)] text-[var(--wc-bg)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'}`}
					>
						{t(`admin.catalog.${k}`)}
					</button>
				))}
			</div>
			<div className="mt-5">
				{/* key: ogni sezione riparte con stato pulito */}
				<CatalogPanel key={kind} kind={kind} />
			</div>
		</div>
	)
}

function CatalogPanel({ kind }: { kind: Kind }) {
	const { t } = useTranslation()
	const uiLang = useLang()
	const toast = useToast()
	// risposta etichettata con la richiesta che l'ha prodotta: chiave diversa = caricamento in corso
	const [result, setResult] = useState<{ key: string; data: Paginated<CatalogRow> | null; error: string | null } | null>(null)
	const [search, setSearch] = useState('')
	const [debounced, setDebounced] = useState('')
	const [category, setCategory] = useState<IngredientCategory | ''>('')
	const [sort, setSort] = useState<SortOption>(DEFAULT_SORT)
	const [page, setPage] = useState(1)
	const [reload, setReload] = useState(0)
	const [editing, setEditing] = useState<CatalogRow | 'new' | null>(null)
	const [deleting, setDeleting] = useState<CatalogRow | null>(null)

	// la ricerca parte 300 ms dopo l'ultimo tasto e torna alla prima pagina
	useEffect(() => {
		const id = window.setTimeout(() => {
			setDebounced(search.trim())
			setPage(1)
		}, 300)
		return () => window.clearTimeout(id)
	}, [search])

	const [sortBy, sortOrder] = sort.split(':') as [AdminCatalogSortBy, SortOrder]
	const requestKey = [kind, page, debounced, category, sort, reload].join('|')

	useEffect(() => {
		let cancelled = false
		const path = `${ADMIN_CATALOG}/${kind}${qs({
			page,
			limit: PAGE_SIZE,
			search: debounced,
			category: kind === 'ingredients' ? category : undefined,
			sort_by: sortBy,
			sort_order: sortOrder,
		})}`
		api
			.get<unknown>(path)
			.then((res) => {
				if (cancelled) return
				const pageData = toPage<CatalogRow>(res, PAGE_SIZE)
				// pagina oltre l'ultima (es. dopo un'eliminazione da un'altra scheda): torna all'ultima disponibile
				if (pageData.items.length === 0 && page > 1 && pageData.total > 0) {
					setPage(Math.max(1, Math.min(page - 1, pageData.total_pages)))
					return
				}
				setResult({ key: requestKey, data: pageData, error: null })
			})
			.catch((err) => {
				if (!cancelled) setResult({ key: requestKey, data: null, error: getErrorMessage(err, t('admin.catalog.loadError')) })
			})
		return () => {
			cancelled = true
		}
	}, [kind, page, debounced, category, sortBy, sortOrder, requestKey, t])

	const current = result?.key === requestKey ? result : null
	// durante il caricamento resta visibile la pagina precedente (niente salti di layout)
	const data = current?.data ?? result?.data ?? null
	const rows = data?.items ?? []
	const loading = current === null
	const error = current?.error ?? null

	async function remove(row: CatalogRow) {
		const { name } = displayName(row, uiLang)
		try {
			await api.delete(`${ADMIN_CATALOG}/${kind}/${row.id}`)
			toast.success(t('admin.catalog.deleted', { name }))
			setDeleting(null)
			// ultima voce della pagina: si torna alla pagina precedente invece di restare su una pagina vuota
			if (rows.length === 1 && page > 1) setPage((p) => p - 1)
			else setReload((n) => n + 1)
		} catch (err) {
			setDeleting(null)
			// vincolo referenziale: l'elemento è usato da almeno una ricetta
			if (err instanceof ApiError && err.status === 409) {
				toast.error(t(kind === 'ingredients' ? 'admin.catalog.ingredientInUse' : 'admin.catalog.tagInUse', { name }))
			} else {
				toast.error(getErrorMessage(err, t('admin.catalog.deleteError')))
			}
		}
	}

	return (
		<div>
			{/* barra strumenti: ricerca con icona + ordinamento + pulsante "nuovo", sotto le categorie come pillole */}
			<div className="space-y-3 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-3">
				<div className="flex flex-wrap items-center gap-3">
					<div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
							className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--wc-text-muted)]"
						>
							<circle cx="11" cy="11" r="7" />
							<path d="m20 20-3.5-3.5" />
						</svg>
						<input
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t('admin.catalog.search')}
							aria-label={t('admin.catalog.search')}
							className="w-full rounded-full border border-[var(--wc-border)] bg-[var(--wc-bg)] py-2 pl-9 pr-4 text-sm text-[var(--wc-text)] outline-none placeholder:text-[var(--wc-text-muted)] focus:border-[var(--wc-basil)]"
						/>
					</div>
					<label className="flex items-center gap-2 text-xs text-[var(--wc-text-muted)]">
						{t('search.sortBy')}
						<select
							value={sort}
							onChange={(e) => {
								setSort(e.target.value as SortOption)
								setPage(1)
							}}
							className="rounded-full border border-[var(--wc-border)] bg-[var(--wc-bg)] px-3 py-1.5 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]"
						>
							{SORT_OPTIONS.map((o) => (
								<option key={o} value={o}>
									{t(`admin.catalog.sort.${o.replace(':', '_')}`)}
								</option>
							))}
						</select>
					</label>
					{data && <span className="text-xs text-[var(--wc-text-muted)]">{t('admin.catalog.count', { count: data.total })}</span>}
					<button
						onClick={() => setEditing('new')}
						className="ml-auto rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
					>
						+ {t(kind === 'ingredients' ? 'admin.catalog.newIngredient' : 'admin.catalog.newTag')}
					</button>
				</div>

				{kind === 'ingredients' && (
					<div role="radiogroup" aria-label={t('admin.catalog.category')} className="flex flex-wrap gap-1.5">
						{(['', ...CATEGORIES] as const).map((c) => {
							const active = category === c
							return (
								<button
									key={c || 'all'}
									type="button"
									role="radio"
									aria-checked={active}
									onClick={() => {
										setCategory(c)
										setPage(1)
									}}
									className={`rounded-full border px-3 py-1 text-xs transition-colors ${
										active
											? 'border-[var(--wc-basil)] bg-[var(--wc-basil)] text-[var(--wc-bg)]'
											: 'border-[var(--wc-border)] text-[var(--wc-text-muted)] hover:border-[var(--wc-basil)] hover:text-[var(--wc-text)]'
									}`}
								>
									{c ? t(`ingredientCategory.${c}`) : t('admin.catalog.allCategoriesShort')}
								</button>
							)
						})}
					</div>
				)}
			</div>

			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{loading && !data && (
				<div className="mt-4">
					<ListSkeleton />
				</div>
			)}
			{!loading && data && rows.length === 0 && !error && <p className="mt-6 text-[var(--wc-text-muted)]">{t('admin.catalog.empty')}</p>}

			{rows.length > 0 && (
				<div
					className={`mt-4 overflow-x-auto rounded-2xl border border-[var(--wc-border)] transition-opacity ${loading ? 'opacity-60' : ''}`}
					aria-busy={loading}
				>
					<table className="w-full min-w-[640px] border-collapse text-sm">
						<thead>
							<tr className="bg-[var(--wc-surface)] text-left text-[var(--wc-text-muted)]">
								<th className="p-3">ID</th>
								<th className="p-3">{t('admin.catalog.slug')}</th>
								{kind === 'ingredients' && <th className="p-3">{t('admin.catalog.category')}</th>}
								<th className="p-3">{t('admin.catalog.name')}</th>
								<th className="p-3 text-right">{t('admin.users.actions')}</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => {
								const { name, fallbackLang } = displayName(r, uiLang)
								const allNames = LANGS.map((l) => `${l.toUpperCase()}: ${r.translations?.[l] || '—'}`).join(' · ')
								return (
									<tr key={r.id} className="border-t border-[var(--wc-border)]">
										<td className="p-3 text-[var(--wc-text-muted)]">{r.id}</td>
										<td className="p-3 font-mono text-xs">{r.slug}</td>
										{kind === 'ingredients' && (
											<td className="p-3">
												{r.category && (
													<span className="rounded-full border border-[var(--wc-border)] px-2 py-0.5 text-xs text-[var(--wc-saffron)]">
														{t(`ingredientCategory.${r.category}`)}
													</span>
												)}
											</td>
										)}
										<td className="p-3" title={allNames}>
											{name}
											{fallbackLang && (
												<span className="ml-2 text-xs text-[var(--wc-text-muted)]" title={t('admin.catalog.fallback')}>
													({fallbackLang})
												</span>
											)}
										</td>
										<td className="p-3">
											<div className="flex justify-end gap-2">
												<button onClick={() => setEditing(r)} className={BTN_OUTLINE}>
													{t('common.edit')}
												</button>
												<button
													onClick={() => setDeleting(r)}
													className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-sm text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)]"
												>
													{t('common.delete')}
												</button>
											</div>
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

			{data && (
				<Pagination
					className="mt-6"
					page={page}
					totalPages={data.total_pages}
					hasPrev={data.has_prev_page}
					hasNext={data.has_next_page}
					onChange={setPage}
				/>
			)}

			{editing && (
				<CatalogDialog
					kind={kind}
					row={editing === 'new' ? null : editing}
					onClose={() => setEditing(null)}
					onSaved={(created) => {
						setEditing(null)
						toast.success(t(created ? 'admin.catalog.created' : 'admin.catalog.updated'))
						setReload((n) => n + 1)
					}}
				/>
			)}
			{deleting && (
				<ConfirmDialog
					title={t('admin.catalog.confirmDeleteTitle', { name: displayName(deleting, uiLang).name })}
					confirmLabel={t('common.delete')}
					danger
					onConfirm={() => remove(deleting)}
					onClose={() => setDeleting(null)}
				>
					<p>{t('admin.catalog.confirmDelete', { slug: deleting.slug })}</p>
				</ConfirmDialog>
			)}
		</div>
	)
}

interface CatalogDialogProps {
	kind: Kind
	// null = creazione
	row: CatalogRow | null
	onClose: () => void
	onSaved: (created: boolean) => void
}

function CatalogDialog({ kind, row, onClose, onSaved }: CatalogDialogProps) {
	const { t } = useTranslation()
	const isEdit = row !== null
	const [slug, setSlug] = useState(row?.slug ?? '')
	const [category, setCategory] = useState<IngredientCategory>(row?.category ?? 'other')
	// in modifica i nomi arrivano già dalla riga dell'elenco (translations { it, en, fr }): nessuna GET di dettaglio
	const [translations, setTranslations] = useState<CatalogTranslations>(() => ({ ...EMPTY_TRANSLATIONS, ...(row?.translations ?? {}) }))
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const slugInvalid = !isEdit && slug.length > 0 && (!SLUG_RE.test(slug) || slug.length > SLUG_MAX[kind])

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setError(null)
		const names: CatalogTranslations = { it: translations.it.trim(), en: translations.en.trim(), fr: translations.fr.trim() }
		if (LANGS.some((l) => !names[l])) return setError(t('admin.catalog.errors.allNames'))
		if (!isEdit && (!SLUG_RE.test(slug) || slug.length > SLUG_MAX[kind])) {
			return setError(t('admin.catalog.errors.slug', { max: SLUG_MAX[kind] }))
		}
		setSubmitting(true)
		try {
			if (kind === 'ingredients') {
				if (isEdit) {
					const body: UpdateIngredientDto = { translations: names }
					await api.patch<IngredientDetailResponseDto>(`${ADMIN_CATALOG}/ingredients/${row.id}`, body)
				} else {
					const body: CreateIngredientDto = { slug, category, translations: names }
					await api.post<IngredientDetailResponseDto>(`${ADMIN_CATALOG}/ingredients`, body)
				}
			} else if (isEdit) {
				const body: UpdateTagDto = { translations: names }
				await api.patch<TagDetailResponseDto>(`${ADMIN_CATALOG}/tags/${row.id}`, body)
			} else {
				const body: CreateTagDto = { slug, translations: names }
				await api.post<TagDetailResponseDto>(`${ADMIN_CATALOG}/tags`, body)
			}
			onSaved(!isEdit)
		} catch (err) {
			setError(
				err instanceof ApiError && err.status === 409 ? t('admin.catalog.errors.slugTaken') : getErrorMessage(err, t('form.errors.saveFailed')),
			)
			setSubmitting(false)
		}
	}

	const title = isEdit
		? t('admin.catalog.editTitle', { slug: row.slug })
		: t(kind === 'ingredients' ? 'admin.catalog.newIngredient' : 'admin.catalog.newTag')

	return (
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose()
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onClose()
			}}
		>
			<form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6">
				<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{title}</h2>

				<div>
					<label htmlFor="cat-slug" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						{t('admin.catalog.slug')}
					</label>
					<input
						id="cat-slug"
						required
						disabled={isEdit}
						maxLength={SLUG_MAX[kind]}
						value={slug}
						onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[\s-]+/g, '_'))}
						aria-invalid={slugInvalid}
						className={`${INPUT} font-mono ${slugInvalid ? 'border-[var(--wc-paprika)]' : ''}`}
						placeholder={kind === 'ingredients' ? 'bell_pepper' : 'gluten_free'}
					/>
					<p className="mt-1 text-xs text-[var(--wc-text-muted)]">
						{isEdit ? t('admin.catalog.immutable') : t('admin.catalog.slugHelp', { max: SLUG_MAX[kind] })}
					</p>
				</div>

				{kind === 'ingredients' && (
					<div>
						<label htmlFor="cat-category" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
							{t('admin.catalog.category')}
						</label>
						<select
							id="cat-category"
							disabled={isEdit}
							value={category}
							onChange={(e) => setCategory(e.target.value as IngredientCategory)}
							className={INPUT}
						>
							{CATEGORIES.map((c) => (
								<option key={c} value={c}>
									{t(`ingredientCategory.${c}`)}
								</option>
							))}
						</select>
					</div>
				)}

				<fieldset className="space-y-2">
					<legend className="mb-1 text-sm text-[var(--wc-text-muted)]">{t('admin.catalog.translations')}</legend>
					{LANGS.map((l) => (
						<label key={l} className="flex items-center gap-3 text-sm">
							<span className="w-20 shrink-0 text-[var(--wc-text-muted)]">{t(`lang.${l}`)}</span>
							<input
								required
								maxLength={100}
								value={translations[l]}
								onChange={(e) => setTranslations((prev) => ({ ...prev, [l]: e.target.value }))}
								className={INPUT}
							/>
						</label>
					))}
				</fieldset>

				{error && (
					<p role="alert" className="text-sm text-[var(--wc-paprika)]">
						{error}
					</p>
				)}

				<div className="flex justify-end gap-2">
					<button type="button" onClick={onClose} className="rounded-full border border-[var(--wc-border)] px-4 py-2 text-sm hover:border-[var(--wc-basil)]">
						{t('common.cancel')}
					</button>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
					>
						{submitting ? t('common.saving') : t('common.save')}
					</button>
				</div>
			</form>
		</div>
	)
}

export default AdminCatalog
