import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api, ApiError, asArray, getErrorMessage, qs } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../lib/useLang'
import ConfirmDialog from '../../components/ConfirmDialog'
import { ListSkeleton } from '../../components/Skeleton'
import type {
	CatalogTranslations,
	CreateIngredientDto,
	CreateTagDto,
	IngredientCategory,
	IngredientDetailResponseDto,
	Lang,
	TagDetailResponseDto,
	UpdateIngredientDto,
	UpdateTagDto,
} from '../../types/models'

// gestione del catalogo multilingua (solo admin):
//   GET    /ingredients?category=&search=&lang=   GET /tags?lang=
//   POST   /ingredients (CreateIngredientDto)    POST /tags (CreateTagDto)
//   PATCH  /ingredients/:id (UpdateIngredientDto) PATCH /tags/:id (UpdateTagDto)  → solo translations
//   DELETE /ingredients/:id                      DELETE /tags/:id               → 409 se usati in ricette

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
const SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/
const SLUG_MAX: Record<Kind, number> = { ingredients: 100, tags: 50 }
const EMPTY_TRANSLATIONS: CatalogTranslations = { it: '', en: '', fr: '' }

// voce del catalogo come arriva dalle GET (nome già localizzato)
interface CatalogRow {
	id: number
	slug: string
	name: string
	category?: IngredientCategory
	resolved_lang?: Lang
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
	const [rows, setRows] = useState<CatalogRow[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [debounced, setDebounced] = useState('')
	const [category, setCategory] = useState<IngredientCategory | ''>('')
	const [reload, setReload] = useState(0)
	const [editing, setEditing] = useState<CatalogRow | 'new' | null>(null)
	const [deleting, setDeleting] = useState<CatalogRow | null>(null)

	useEffect(() => {
		const id = window.setTimeout(() => setDebounced(search.trim()), 300)
		return () => window.clearTimeout(id)
	}, [search])

	useEffect(() => {
		let cancelled = false
		const path =
			kind === 'ingredients'
				? `/ingredients${qs({ category, search: debounced, lang: uiLang })}`
				: `/tags${qs({ lang: uiLang })}`
		api
			.get<CatalogRow[]>(path)
			.then((res) => {
				if (cancelled) return
				setRows(asArray<CatalogRow>(res))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setRows([])
				setError(getErrorMessage(err, t('admin.catalog.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [kind, category, debounced, uiLang, reload, t])

	// GET /tags non ha un parametro search: per i tag si filtra lato client
	const visible = useMemo(() => {
		if (!rows) return []
		if (kind === 'ingredients' || !debounced) return rows
		const q = debounced.toLowerCase()
		return rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q))
	}, [rows, kind, debounced])

	async function remove(row: CatalogRow) {
		try {
			await api.delete(`/${kind}/${row.id}`)
			toast.success(t('admin.catalog.deleted', { name: row.name }))
			setDeleting(null)
			setReload((n) => n + 1)
		} catch (err) {
			setDeleting(null)
			// vincolo referenziale: l'elemento è usato da almeno una ricetta
			if (err instanceof ApiError && err.status === 409) {
				toast.error(t(kind === 'ingredients' ? 'admin.catalog.ingredientInUse' : 'admin.catalog.tagInUse', { name: row.name }))
			} else {
				toast.error(getErrorMessage(err, t('admin.catalog.deleteError')))
			}
		}
	}

	return (
		<div>
			{/* barra strumenti: ricerca con icona + pulsante "nuovo", sotto le categorie come pillole */}
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
					{rows && (
						<span className="text-xs text-[var(--wc-text-muted)]">{t('admin.catalog.count', { count: visible.length })}</span>
					)}
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
									onClick={() => setCategory(c)}
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
			{!rows && (
				<div className="mt-4">
					<ListSkeleton />
				</div>
			)}
			{rows && visible.length === 0 && !error && <p className="mt-6 text-[var(--wc-text-muted)]">{t('admin.catalog.empty')}</p>}

			{visible.length > 0 && (
				<div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--wc-border)]">
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
							{visible.map((r) => (
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
									<td className="p-3">
										{r.name}
										{r.resolved_lang && r.resolved_lang !== uiLang && (
											<span className="ml-2 text-xs text-[var(--wc-text-muted)]" title={t('admin.catalog.fallback')}>
												({r.resolved_lang})
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
							))}
						</tbody>
					</table>
				</div>
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
					title={t('admin.catalog.confirmDeleteTitle', { name: deleting.name })}
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

// i nomi esistenti nelle tre lingue si ricavano dalle GET con ?lang=it|en|fr
// (solo se resolved_lang coincide: altrimenti è un fallback e il campo resta vuoto)
async function loadTranslations(kind: Kind, id: number): Promise<CatalogTranslations> {
	const lists = await Promise.all(LANGS.map((l) => api.get<CatalogRow[]>(`/${kind}${qs({ lang: l })}`).then((r) => asArray<CatalogRow>(r))))
	const out: CatalogTranslations = { ...EMPTY_TRANSLATIONS }
	LANGS.forEach((l, i) => {
		const row = lists[i].find((x) => x.id === id)
		if (row && (!row.resolved_lang || row.resolved_lang === l)) out[l] = row.name
	})
	return out
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
	const [translations, setTranslations] = useState<CatalogTranslations>(EMPTY_TRANSLATIONS)
	const [loadingNames, setLoadingNames] = useState(isEdit)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!row) return
		let cancelled = false
		loadTranslations(kind, row.id)
			.then((tr) => {
				if (!cancelled) setTranslations(tr)
			})
			.catch(() => {
				// se fallisce si parte dai campi vuoti: l'admin li compila a mano
			})
			.finally(() => {
				if (!cancelled) setLoadingNames(false)
			})
		return () => {
			cancelled = true
		}
	}, [kind, row])

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
					await api.patch<IngredientDetailResponseDto>(`/ingredients/${row.id}`, body)
				} else {
					const body: CreateIngredientDto = { slug, category, translations: names }
					await api.post<IngredientDetailResponseDto>('/ingredients', body)
				}
			} else if (isEdit) {
				const body: UpdateTagDto = { translations: names }
				await api.patch<TagDetailResponseDto>(`/tags/${row.id}`, body)
			} else {
				const body: CreateTagDto = { slug, translations: names }
				await api.post<TagDetailResponseDto>('/tags', body)
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

				<fieldset className="space-y-2" disabled={loadingNames}>
					<legend className="mb-1 text-sm text-[var(--wc-text-muted)]">
						{t('admin.catalog.translations')}
						{loadingNames && ` · ${t('common.loading')}`}
					</legend>
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
						disabled={submitting || loadingNames}
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
