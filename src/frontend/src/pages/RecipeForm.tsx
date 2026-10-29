import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, assetUrl, getErrorMessage, qs } from '../api/client'
import { FEATURES, UPLOAD_LIMITS } from '../config'
import { SUPPORTED_LANGS } from '../i18n'
import { validateImage, validateVideo } from '../lib/files'
import { useLang } from '../lib/useLang'
import { useObjectUrl } from '../lib/useObjectUrl'
import IngredientPicker from '../components/IngredientPicker'
import { Skeleton } from '../components/Skeleton'
import type {
	CatalogIngredient,
	CatalogTag,
	Course,
	CreateRecipeBody,
	Lang,
	RecipeDetail,
	RecipeDifficulty,
	RecipeVisibility,
	Unit,
} from '../types/models'

const COURSES: Course[] = ['appetizer', 'first_course', 'main_course', 'dessert', 'side_dish', 'drink', 'snack']
const DIFFICULTIES: RecipeDifficulty[] = ['easy', 'medium', 'hard']
const UNITS: Unit[] = ['g', 'kg', 'ml', 'cl', 'l', 'oz', 'lb', 'fl_oz', 'cup', 'tbsp', 'tsp', 'piece', 'pinch']
const VISIBILITIES: RecipeVisibility[] = ['public', 'friends', 'private']

const FIELD_BASE =
	'rounded-lg border bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)] aria-[invalid=true]:border-[var(--wc-paprika)] border-[var(--wc-border)]'
// i campi a larghezza fissa (quantità, unità) non devono ereditare w-full, altrimenti schiacciano il nome dell'ingrediente
const FIELD = `w-full ${FIELD_BASE}`
const SELECT = `${FIELD} h-[42px]`
const LABEL = 'mb-1 block text-sm text-[var(--wc-text-muted)]'
const SECTION_TITLE = 'font-display text-xl text-[var(--wc-saffron)]'
const SECONDARY_BTN =
	'rounded-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4 py-2 text-sm font-medium text-[var(--wc-text)] transition-colors hover:border-[var(--wc-basil)] hover:text-[var(--wc-basil)]'

// nello stato del form i numeri sono stringhe: così il campo si può svuotare senza che venga rimesso uno zero
interface IngredientRow {
	key: number
	ingredient: CatalogIngredient | null
	quantity: string
	unit: Unit
	notes: unknown
}

interface StepRow {
	key: number
	title: string
	description: string
	duration: string
	imageFile: File | null
	existingImageUrl: string | null
	removeExistingImage: boolean
}

interface ExistingGalleryItem {
	id: number
	url: string
}

type FieldErrors = Record<string, string>

function Field({ label, htmlFor, error, children }: { label: string; htmlFor?: string; error?: string; children: ReactNode }) {
	return (
		<div>
			<label htmlFor={htmlFor} className={LABEL}>
				{label}
			</label>
			{children}
			{error && <p className="mt-1 text-xs text-[var(--wc-paprika)]">{error}</p>}
		</div>
	)
}

// anteprima + pulsanti per una singola immagine (copertina o foto di uno step)
function ImagePicker({
	label,
	file,
	existingUrl,
	onPick,
	onClear,
}: {
	label: string
	file: File | null
	existingUrl: string | null
	onPick: (file: File) => void
	onClear: () => void
}) {
	const { t } = useTranslation()
	const toast = useToast()
	const inputRef = useRef<HTMLInputElement>(null)
	const preview = useObjectUrl(file)
	const shown = preview ?? assetUrl(existingUrl)

	return (
		<div className="flex items-center gap-3">
			{shown ? (
				<img src={shown} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
			) : (
				<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--wc-border)] text-xs text-[var(--wc-text-muted)]">
					{t('form.optional')}
				</div>
			)}
			<input
				ref={inputRef}
				type="file"
				accept={UPLOAD_LIMITS.imageTypes.join(',')}
				aria-label={label}
				className="hidden"
				onChange={(e) => {
					const picked = e.target.files?.[0]
					// permette di riselezionare lo stesso file dopo averlo rimosso
					e.target.value = ''
					if (!picked) return
					const err = validateImage(picked, t)
					if (err) return toast.error(err)
					onPick(picked)
				}}
			/>
			<button type="button" onClick={() => inputRef.current?.click()} className={SECONDARY_BTN}>
				{shown ? t('form.replaceImage') : label}
			</button>
			{shown && (
				<button type="button" onClick={onClear} className="text-sm text-[var(--wc-paprika)] hover:underline">
					{t('common.remove')}
				</button>
			)}
		</div>
	)
}

function GalleryThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
	const { t } = useTranslation()
	const url = useObjectUrl(file)
	return (
		<li className="relative">
			{url && <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />}
			<button
				type="button"
				onClick={onRemove}
				aria-label={t('common.remove')}
				className="absolute right-1 top-1 rounded-full bg-[var(--wc-bg)]/90 px-2 text-sm text-[var(--wc-paprika)]"
			>
				×
			</button>
		</li>
	)
}

// chiavi React stabili per le righe dinamiche (ingredienti, passaggi)
let keySeq = 1
const nextKey = () => keySeq++

function RecipeForm() {
	const { id } = useParams()
	const isEdit = Boolean(id)
	const navigate = useNavigate()
	const { t } = useTranslation()
	const uiLang = useLang()
	const toast = useToast()
	const { user } = useAuth()
	const newIngredient = (): IngredientRow => ({ key: nextKey(), ingredient: null, quantity: '', unit: 'g', notes: undefined })
	const newStep = (): StepRow => ({
		key: nextKey(),
		title: '',
		description: '',
		duration: '',
		imageFile: null,
		existingImageUrl: null,
		removeExistingImage: false,
	})

	// ─── stato del form ───
	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [sourceLang, setSourceLang] = useState<Lang>(uiLang)
	// in modifica: lingua del testo che si sta modificando (di default quella originale; il backend la riceve come `locale`)
	const [editLocale, setEditLocale] = useState<Lang>(uiLang)
	const [switchingLocale, setSwitchingLocale] = useState(false)
	const [course, setCourse] = useState<Course>('main_course')
	const [difficulty, setDifficulty] = useState<RecipeDifficulty>('easy')
	const [servings, setServings] = useState('4')
	const [prepTime, setPrepTime] = useState('15')
	const [cookTime, setCookTime] = useState('15')
	const [visibility, setVisibility] = useState<RecipeVisibility>('public')
	const [tagIds, setTagIds] = useState<number[]>([])
	const [ingredients, setIngredients] = useState<IngredientRow[]>(() => [newIngredient()])
	const [steps, setSteps] = useState<StepRow[]>(() => [newStep()])
	const [tips, setTips] = useState('')
	const [preservation, setPreservation] = useState('')

	// media
	const [coverFile, setCoverFile] = useState<File | null>(null)
	const [existingCover, setExistingCover] = useState<string | null>(null)
	const [removeCover, setRemoveCover] = useState(false)
	const [galleryFiles, setGalleryFiles] = useState<File[]>([])
	const [existingGallery, setExistingGallery] = useState<ExistingGalleryItem[]>([])
	const [removedGalleryIds, setRemovedGalleryIds] = useState<number[]>([])
	const [videoFile, setVideoFile] = useState<File | null>(null)
	const [existingVideo, setExistingVideo] = useState<string | null>(null)
	const [removeVideo, setRemoveVideo] = useState(false)
	const galleryInputRef = useRef<HTMLInputElement>(null)
	const videoInputRef = useRef<HTMLInputElement>(null)

	// catalogo (ingredienti e tag) e stato della pagina
	const [catalog, setCatalog] = useState<CatalogIngredient[]>([])
	const [tagCatalog, setTagCatalog] = useState<CatalogTag[]>([])
	const [catalogError, setCatalogError] = useState(false)
	const [errors, setErrors] = useState<FieldErrors>({})
	const [loading, setLoading] = useState(isEdit)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [forbidden, setForbidden] = useState(false)
	const [saving, setSaving] = useState(false)
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

	// ─── caricamento catalogo ───
	useEffect(() => {
		let cancelled = false
		Promise.all([
			api.get<CatalogIngredient[]>(`/ingredients${qs({ lang: uiLang })}`),
			api.get<CatalogTag[]>(`/tags${qs({ lang: uiLang })}`),
		])
			.then(([ing, tags]) => {
				if (cancelled) return
				setCatalog(Array.isArray(ing) ? ing : [])
				setTagCatalog(Array.isArray(tags) ? tags : [])
				setCatalogError(false)
			})
			.catch(() => {
				if (!cancelled) setCatalogError(true)
			})
		return () => {
			cancelled = true
		}
	}, [uiLang])

	// ─── caricamento ricetta in modifica ───
	useEffect(() => {
		if (!id || !user) return
		let cancelled = false

		async function load() {
			let recipe = await api.get<RecipeDetail>(`/recipes/${id}${qs({ lang: uiLang })}`)
			// si modifica sempre nella lingua originale, così il testo salvato resta coerente con source_lang
			if (recipe.resolved_lang !== recipe.source_lang) {
				recipe = await api.get<RecipeDetail>(`/recipes/${id}${qs({ lang: recipe.source_lang })}`)
			}
			if (cancelled) return
			if (user && recipe.author?.id !== user.id && user.role !== 'admin') {
				setForbidden(true)
				return
			}
			setTitle(recipe.title)
			setDescription(recipe.description)
			setSourceLang(recipe.source_lang)
			setEditLocale(recipe.source_lang)
			setCourse(recipe.course)
			setDifficulty(recipe.difficulty)
			setServings(String(recipe.servings))
			setPrepTime(String(recipe.prep_time))
			setCookTime(String(recipe.cook_time))
			if (recipe.visibility) setVisibility(recipe.visibility)
			setTagIds(recipe.tags.map((tg) => tg.id))
			setTips(recipe.tips ?? '')
			setPreservation(recipe.preservation ?? '')
			setIngredients(
				recipe.ingredients.length
					? recipe.ingredients.map((ing) => ({
							key: nextKey(),
							ingredient: { id: ing.id, slug: ing.slug, category: ing.category, name: ing.name },
							quantity: String(ing.quantity),
							unit: ing.unit,
							notes: ing.notes ?? undefined,
						}))
					: [newIngredient()],
			)
			setSteps(
				recipe.steps.length
					? [...recipe.steps]
							.sort((a, b) => a.step_number - b.step_number)
							.map((s) => ({
								key: nextKey(),
								title: s.title ?? '',
								description: s.description,
								duration: s.duration != null ? String(s.duration) : '',
								imageFile: null,
								existingImageUrl: s.image_url,
								removeExistingImage: false,
							}))
					: [newStep()],
			)
			setExistingCover(recipe.cover_image_url)
			setExistingVideo(recipe.video_url)
			setExistingGallery(
				recipe.media.filter((m) => m.media_type === 'image').map((m) => ({ id: m.id, url: m.url })),
			)
		}

		load()
			.catch((err) => setLoadError(err instanceof ApiError && err.status !== 404 ? err.message : t('recipe.notFound')))
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- la ricetta si carica una volta per id/utente (non a ogni cambio lingua)
	}, [id, user])

	// cambio della lingua di modifica: si ricaricano i soli testi tradotti (titolo, descrizione, passaggi, consigli…)
	async function switchEditLocale(next: Lang) {
		if (!id || next === editLocale) return
		setSwitchingLocale(true)
		try {
			const r = await api.get<RecipeDetail>(`/recipes/${id}${qs({ lang: next })}`)
			if (r.resolved_lang !== next) {
				toast.info(t('form.localeUnavailable', { lang: t(`lang.${next}`) }))
				return
			}
			setTitle(r.title)
			setDescription(r.description)
			setTips(r.tips ?? '')
			setPreservation(r.preservation ?? '')
			const translated = [...r.steps].sort((a, b) => a.step_number - b.step_number)
			setSteps((prev) =>
				prev.map((row, i) => (translated[i] ? { ...row, title: translated[i].title ?? '', description: translated[i].description } : row)),
			)
			setEditLocale(next)
			setErrors({})
		} catch (err) {
			toast.error(getErrorMessage(err, t('form.errors.saveFailed')))
		} finally {
			setSwitchingLocale(false)
		}
	}

	// ─── helpers di aggiornamento ───
	const updateIngredient = (key: number, patch: Partial<IngredientRow>) =>
		setIngredients((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
	const updateStep = (key: number, patch: Partial<StepRow>) =>
		setSteps((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

	function toggleTag(tagId: number) {
		setTagIds((prev) => (prev.includes(tagId) ? prev.filter((x) => x !== tagId) : [...prev, tagId]))
	}

	function handleGalleryPicked(files: FileList | null) {
		if (!files) return
		const room = UPLOAD_LIMITS.galleryMax - (existingGallery.length - removedGalleryIds.length) - galleryFiles.length
		const accepted: File[] = []
		for (const file of Array.from(files)) {
			const err = validateImage(file, t)
			if (err) {
				toast.error(err)
				continue
			}
			if (accepted.length >= room) {
				toast.error(t('form.errors.galleryMax', { max: UPLOAD_LIMITS.galleryMax }))
				break
			}
			accepted.push(file)
		}
		if (accepted.length) setGalleryFiles((prev) => [...prev, ...accepted])
	}

	function handleVideoPicked(file: File | undefined) {
		if (!file) return
		const err = validateVideo(file, t)
		if (err) return toast.error(err)
		setVideoFile(file)
		setRemoveVideo(false)
	}

	// righe che ripetono un ingrediente già inserito sopra (il backend rifiuta gli ingredienti doppi)
	const duplicateKeys = new Set<number>()
	{
		const seen = new Set<number>()
		for (const row of ingredients) {
			if (!row.ingredient) continue
			if (seen.has(row.ingredient.id)) duplicateKeys.add(row.key)
			else seen.add(row.ingredient.id)
		}
	}

	// ─── validazione ───
	function validate(): FieldErrors {
		const e: FieldErrors = {}
		const num = (v: string) => (v.trim() === '' ? NaN : Number(v))

		if (title.trim().length < 3 || title.trim().length > 255) e.title = t('form.errors.title')
		if (description.trim().length < 10) e.description = t('form.errors.description')
		if (!(num(servings) >= 1)) e.servings = t('form.errors.servings')
		if (!(num(prepTime) >= 0)) e.prepTime = t('form.errors.time')
		if (!(num(cookTime) >= 0)) e.cookTime = t('form.errors.time')

		if (ingredients.length === 0) e.ingredients = t('form.errors.noIngredients')
		ingredients.forEach((row) => {
			if (!row.ingredient) e[`ing-${row.key}`] = t('form.errors.ingredientCatalog')
			else if (duplicateKeys.has(row.key))
				e[`ing-${row.key}`] = t('form.errors.duplicateIngredient', { name: row.ingredient.name })
			else if (!(num(row.quantity) > 0)) e[`ing-${row.key}`] = t('form.errors.quantity')
		})

		if (steps.length === 0) e.steps = t('form.errors.noSteps')
		steps.forEach((row) => {
			if (!row.description.trim()) e[`step-${row.key}`] = t('form.errors.stepDescription')
			const d = row.duration.trim()
			if (d !== '' && !/^\d+$/.test(d)) e[`stepdur-${row.key}`] = t('form.errors.stepDuration')

		})
		return e
	}

	// ─── invio ───
	async function handleSubmit(ev: FormEvent) {
		ev.preventDefault()
		const found = validate()
		setErrors(found)
		if (Object.keys(found).length > 0) {
			toast.error(t('form.errors.fixFields'))
			requestAnimationFrame(() =>
				document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
			)
			return
		}

		const body: CreateRecipeBody = {
			title: title.trim(),
			description: description.trim(),
			course,
			difficulty,
			prep_time: Number(prepTime),
			cook_time: Number(cookTime),
			servings: Number(servings),
			source_lang: sourceLang,
			...(preservation.trim() ? { preservation: preservation.trim() } : {}),
			...(tips.trim() ? { tips: tips.trim() } : {}),
			tag_ids: tagIds,
			steps: steps.map((s, i) => ({
				step_number: i + 1,
				description: s.description.trim(),
				...(s.title.trim() ? { title: s.title.trim() } : {}),
				...(s.duration.trim() !== '' ? { duration: Number(s.duration) } : {}),
			})),
			ingredients: ingredients.map((r) => ({
				ingredient_id: r.ingredient!.id,
				quantity: Number(r.quantity),
				unit: r.unit,
				...(r.notes != null ? { notes: r.notes } : {}),
			})),
			// il campo viene inviato solo quando il backend lo supporta (src/config.ts)
			...(FEATURES.recipeVisibility ? { visibility } : {}),
		}

		setSaving(true)
		let saved: RecipeDetail
		try {
			saved = isEdit
				? await api.patch<RecipeDetail>(`/recipes/${id}${editLocale === sourceLang ? qs({ retranslate: true }) : ''}`, { ...body, locale: editLocale })
				: await api.post<RecipeDetail>('/recipes', body)
		} catch (err) {
			// 400 = validazione o lingua del testo non coerente con quella dichiarata (LibreTranslate)
			toast.error(getErrorMessage(err, t('form.errors.saveFailed')))
			setSaving(false)
			return
		}

		// ─── media: chiamate dedicate dopo il salvataggio ───
		const jobs: (() => Promise<unknown>)[] = []
		const rid = saved.id
		const upload = (path: string, field: string, files: File[]) => () => {
			const fd = new FormData()
			files.forEach((f) => fd.append(field, f))
			return api.post(path, fd)
		}

		if (isEdit) {
			if (removeCover && !coverFile && existingCover) jobs.push(() => api.delete(`/recipes/${rid}/cover`))
			if (removeVideo && !videoFile && existingVideo) jobs.push(() => api.delete(`/recipes/${rid}/video`))
			removedGalleryIds.forEach((mid) => jobs.push(() => api.delete(`/recipes/${rid}/gallery/${mid}`)))
		}
		if (coverFile) jobs.push(upload(`/recipes/${rid}/cover`, 'file', [coverFile]))
		if (galleryFiles.length) jobs.push(upload(`/recipes/${rid}/gallery`, 'files', galleryFiles))
		if (videoFile) jobs.push(upload(`/recipes/${rid}/video`, 'file', [videoFile]))
		steps.forEach((s, i) => {
			const n = i + 1
			if (isEdit && s.removeExistingImage && !s.imageFile && s.existingImageUrl) {
				jobs.push(() => api.delete(`/recipes/${rid}/steps/${n}/image`))
			}
			if (s.imageFile) jobs.push(upload(`/recipes/${rid}/steps/${n}/image`, 'file', [s.imageFile]))
		})

		let failed = 0
		if (jobs.length) {
			setProgress({ done: 0, total: jobs.length })
			for (let i = 0; i < jobs.length; i++) {
				try {
					await jobs[i]()
				} catch {
					failed++
				}
				setProgress({ done: i + 1, total: jobs.length })
			}
		}

		setSaving(false)
		setProgress(null)
		if (failed > 0) toast.error(t('form.mediaPartial', { count: failed }))
		else toast.success(isEdit ? t('form.updated') : t('form.created'))
		navigate(`/recipes/${rid}`)
	}

	// ─── stati di pagina ───
	if (loading) {
		return (
			<div role="status" aria-busy="true" className="mx-auto max-w-2xl space-y-4 px-4 py-12">
				<Skeleton className="h-9 w-56" />
				<Skeleton className="h-11 w-full" />
				<Skeleton className="h-11 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		)
	}

	if (loadError) {
		return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-paprika)]">{loadError}</p>
	}

	if (forbidden) {
		return (
			<div className="mx-auto max-w-xl px-4 py-24 text-center">
				<h1 className="font-display text-3xl text-[var(--wc-paprika)]">{t('form.forbiddenTitle')}</h1>
				<p className="mt-3 text-[var(--wc-text-muted)]">{t('form.forbiddenText')}</p>
			</div>
		)
	}

	const galleryRoom = UPLOAD_LIMITS.galleryMax - (existingGallery.length - removedGalleryIds.length) - galleryFiles.length
	const totalTime = (Number(prepTime) || 0) + (Number(cookTime) || 0)
	const mediaAccept = UPLOAD_LIMITS.videoTypes.join(',')

	return (
		<div className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{isEdit ? t('form.editTitle') : t('form.newTitle')}</h1>

			<form onSubmit={handleSubmit} noValidate className="mt-8 space-y-8">
				{/* ─── informazioni generali ─── */}
				<section className="space-y-4">
					<Field label={t('form.title')} htmlFor="rf-title" error={errors.title}>
						<input
							id="rf-title"
							value={title}
							maxLength={255}
							aria-invalid={Boolean(errors.title)}
							onChange={(e) => setTitle(e.target.value)}
							className={FIELD}
						/>
					</Field>

					<div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-4">
						<Field label={isEdit ? t('form.editLanguage') : t('form.language')} htmlFor="rf-lang">
							<select
								id="rf-lang"
								value={isEdit ? editLocale : sourceLang}
								disabled={switchingLocale}
								onChange={(e) => (isEdit ? void switchEditLocale(e.target.value as Lang) : setSourceLang(e.target.value as Lang))}
								className={SELECT}
							>
								{SUPPORTED_LANGS.map((l) => (
									<option key={l} value={l}>
										{t(`lang.${l}`)}
									</option>
								))}
							</select>
						</Field>
						<Field label={t('recipe.course')} htmlFor="rf-course">
							<select id="rf-course" value={course} onChange={(e) => setCourse(e.target.value as Course)} className={SELECT}>
								{COURSES.map((c) => (
									<option key={c} value={c}>
										{t(`course.${c}`)}
									</option>
								))}
							</select>
						</Field>
						<Field label={t('recipe.difficulty')} htmlFor="rf-diff">
							<select
								id="rf-diff"
								value={difficulty}
								onChange={(e) => setDifficulty(e.target.value as RecipeDifficulty)}
								className={SELECT}
							>
								{DIFFICULTIES.map((d) => (
									<option key={d} value={d}>
										{t(`difficulty.${d}`)}
									</option>
								))}
							</select>
						</Field>
						<Field label={t('recipe.servings')} htmlFor="rf-serv" error={errors.servings}>
							<input
								id="rf-serv"
								type="number"
								min={1}
								step={1}
								value={servings}
								aria-invalid={Boolean(errors.servings)}
								onChange={(e) => setServings(e.target.value)}
								className={FIELD}
							/>
						</Field>
					</div>
					<p className="-mt-2 text-xs text-[var(--wc-text-muted)]">
						{isEdit ? t('form.editLanguageHelp', { lang: t(`lang.${sourceLang}`) }) : t('form.languageHelp')}
					</p>

					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<Field label={t('form.prepTimeMin')} htmlFor="rf-prep" error={errors.prepTime}>
							<input
								id="rf-prep"
								type="number"
								min={0}
								step={1}
								value={prepTime}
								aria-invalid={Boolean(errors.prepTime)}
								onChange={(e) => setPrepTime(e.target.value)}
								className={FIELD}
							/>
						</Field>
						<Field label={t('form.cookTimeMin')} htmlFor="rf-cook" error={errors.cookTime}>
							<input
								id="rf-cook"
								type="number"
								min={0}
								step={1}
								value={cookTime}
								aria-invalid={Boolean(errors.cookTime)}
								onChange={(e) => setCookTime(e.target.value)}
								className={FIELD}
							/>
						</Field>
					</div>
					<p className="-mt-2 text-xs text-[var(--wc-text-muted)]">{t('recipe.totalTime', { count: totalTime })}</p>

					<Field label={t('form.description')} htmlFor="rf-desc" error={errors.description}>
						<textarea
							id="rf-desc"
							rows={3}
							value={description}
							aria-invalid={Boolean(errors.description)}
							onChange={(e) => setDescription(e.target.value)}
							className={FIELD}
						/>
					</Field>
				</section>

				{/* ─── visibilità ─── */}
				<section>
					<h2 className={SECTION_TITLE}>{t('form.visibility')}</h2>
					<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('form.visibility')}>
						{VISIBILITIES.map((v) => (
							<label
								key={v}
								className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition-colors ${
									visibility === v
										? 'border-[var(--wc-basil)] bg-[var(--wc-surface-raised)]'
										: 'border-[var(--wc-border)] hover:border-[var(--wc-basil)]'
								}`}
							>
								<input
									type="radio"
									name="visibility"
									value={v}
									checked={visibility === v}
									onChange={() => setVisibility(v)}
									className="sr-only"
								/>
								<span className="block font-medium text-[var(--wc-text)]">{t(`visibility.${v}`)}</span>
								<span className="block text-xs text-[var(--wc-text-muted)]">{t(`visibility.${v}Help`)}</span>
							</label>
						))}
					</div>
					{!FEATURES.recipeVisibility && (
						<p className="mt-2 text-xs text-[var(--wc-text-muted)]">{t('form.visibilityNotReady')}</p>
					)}
				</section>

				{/* ─── tag ─── */}
				<section>
					<h2 className={SECTION_TITLE}>{t('form.tags')}</h2>
					{tagCatalog.length > 0 ? (
						<ul className="mt-3 flex flex-wrap gap-2">
							{tagCatalog.map((tag) => {
								const active = tagIds.includes(tag.id)
								return (
									<li key={tag.id}>
										<button
											type="button"
											aria-pressed={active}
											onClick={() => toggleTag(tag.id)}
											className={`rounded-full border px-3 py-1 text-sm transition-colors ${
												active
													? 'border-[var(--wc-basil)] bg-[var(--wc-basil)] text-[var(--wc-bg)]'
													: 'border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-basil)]'
											}`}
										>
											{tag.name}
										</button>
									</li>
								)
							})}
						</ul>
					) : (
						<p className="mt-2 text-sm text-[var(--wc-text-muted)]">{catalogError ? t('form.catalogError') : t('form.noTags')}</p>
					)}
				</section>

				{/* ─── ingredienti ─── */}
				<section>
					<h2 className={SECTION_TITLE}>{t('recipe.ingredients')}</h2>
					{catalogError && <p className="mt-2 text-sm text-[var(--wc-paprika)]">{t('form.catalogError')}</p>}
					{!catalogError && catalog.length === 0 && (
						<p className="mt-2 text-sm text-[var(--wc-paprika)]">{t('form.catalogEmpty')}</p>
					)}
					{errors.ingredients && <p className="mt-1 text-xs text-[var(--wc-paprika)]">{errors.ingredients}</p>}
					<div className="mt-3 space-y-3">
						{ingredients.map((row) => {
							const dup = duplicateKeys.has(row.key)
							const err =
								errors[`ing-${row.key}`] ??
								(dup && row.ingredient ? t('form.errors.duplicateIngredient', { name: row.ingredient.name }) : undefined)
							return (
								<div key={row.key}>
									<div className="flex flex-wrap gap-2 sm:flex-nowrap">
										<IngredientPicker
											catalog={catalog}
											value={row.ingredient}
											invalid={Boolean(err) && (!row.ingredient || dup)}
											onChange={(ingredient) => updateIngredient(row.key, { ingredient })}
										/>
										<input
											type="number"
											min={0}
											step="any"
											aria-label={t('form.quantity')}
											placeholder={t('form.quantity')}
											value={row.quantity}
											aria-invalid={Boolean(err) && Boolean(row.ingredient)}
											onChange={(e) => updateIngredient(row.key, { quantity: e.target.value })}
											className={`${FIELD_BASE} h-[42px] w-24 shrink-0`}
										/>
										<select
											aria-label={t('form.unit')}
											value={row.unit}
											onChange={(e) => updateIngredient(row.key, { unit: e.target.value as Unit })}
											className={`${FIELD_BASE} h-[42px] w-28 shrink-0 px-2`}
										>
											{UNITS.map((u) => (
												<option key={u} value={u}>
													{t(`unit.${u}`)}
												</option>
											))}
										</select>
										<button
											type="button"
											onClick={() => setIngredients((prev) => prev.filter((r) => r.key !== row.key))}
											disabled={ingredients.length === 1}
											aria-label={t('common.remove')}
											className="rounded-lg border border-[var(--wc-border)] px-3 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-40"
										>
											×
										</button>
									</div>
									{err && <p className="mt-1 text-xs text-[var(--wc-paprika)]">{err}</p>}
								</div>
							)
						})}
					</div>
					<button type="button" onClick={() => setIngredients((prev) => [...prev, newIngredient()])} className={`mt-3 ${SECONDARY_BTN}`}>
						+ {t('form.addIngredient')}
					</button>
				</section>

				{/* ─── passaggi ─── */}
				<section>
					<h2 className={SECTION_TITLE}>{t('recipe.preparation')}</h2>
					{errors.steps && <p className="mt-1 text-xs text-[var(--wc-paprika)]">{errors.steps}</p>}
					<ol className="mt-3 space-y-4">
						{steps.map((step, index) => {
							const err = errors[`step-${step.key}`]
							const durErr =
								errors[`stepdur-${step.key}`] ??
								(step.duration.trim() !== '' && !/^\d+$/.test(step.duration.trim()) ? t('form.errors.stepDuration') : undefined)
							return (
								<li key={step.key} className="rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4">
									<div className="mb-3 flex items-center justify-between">
										<span className="font-medium text-[var(--wc-text)]">{t('form.stepN', { n: index + 1 })}</span>
										<button
											type="button"
											onClick={() => setSteps((prev) => prev.filter((r) => r.key !== step.key))}
											disabled={steps.length === 1}
											className="text-sm text-[var(--wc-paprika)] hover:underline disabled:opacity-40"
										>
											{t('common.remove')}
										</button>
									</div>
									<div className="space-y-3">
										<input
											value={step.title}
											maxLength={255}
											placeholder={t('form.stepTitle')}
											aria-label={t('form.stepTitle')}
											onChange={(e) => updateStep(step.key, { title: e.target.value })}
											className={FIELD}
										/>
										<textarea
											rows={3}
											value={step.description}
											placeholder={t('form.stepDescription')}
											aria-label={t('form.stepDescription')}
											aria-invalid={Boolean(err)}
											onChange={(e) => updateStep(step.key, { description: e.target.value })}
											className={FIELD}
										/>
										{err && <p className="text-xs text-[var(--wc-paprika)]">{err}</p>}
										<div className="flex flex-wrap items-center gap-4">
											<div>
												<input
													type="text"
													inputMode="numeric"
													value={step.duration}
													placeholder={t('form.stepDuration')}
													aria-label={t('form.stepDuration')}
													aria-invalid={Boolean(durErr)}
													onChange={(e) => updateStep(step.key, { duration: e.target.value })}
													className={`${FIELD} w-40`}
												/>
												{durErr && <p className="mt-1 text-xs text-[var(--wc-paprika)]">{durErr}</p>}
											</div>
											<ImagePicker
												label={t('form.addStepPhoto')}
												file={step.imageFile}
												existingUrl={step.removeExistingImage ? null : step.existingImageUrl}
												onPick={(file) => updateStep(step.key, { imageFile: file, removeExistingImage: false })}
												onClear={() =>
													updateStep(step.key, { imageFile: null, removeExistingImage: Boolean(step.existingImageUrl) })
												}
											/>
										</div>
									</div>
								</li>
							)
						})}
					</ol>
					<button type="button" onClick={() => setSteps((prev) => [...prev, newStep()])} className={`mt-4 ${SECONDARY_BTN}`}>
						+ {t('form.addStep')}
					</button>
				</section>

				{/* ─── consigli e conservazione ─── */}
				<section className="space-y-4">
					<Field label={t('recipe.tips')} htmlFor="rf-tips">
						<textarea id="rf-tips" rows={3} value={tips} onChange={(e) => setTips(e.target.value)} className={FIELD} />
					</Field>
					<Field label={t('recipe.preservation')} htmlFor="rf-pres">
						<textarea
							id="rf-pres"
							rows={3}
							value={preservation}
							onChange={(e) => setPreservation(e.target.value)}
							className={FIELD}
						/>
					</Field>
				</section>

				{/* ─── foto e video ─── */}
				<section className="space-y-5">
					<h2 className={SECTION_TITLE}>{t('form.media')}</h2>
					<p className="text-xs text-[var(--wc-text-muted)]">
						{t('form.mediaHelp', { imageMax: UPLOAD_LIMITS.imageMaxMb, videoMax: UPLOAD_LIMITS.videoMaxMb })}
					</p>

					<div>
						<span className={LABEL}>{t('form.cover')}</span>
						<ImagePicker
							label={t('form.chooseCover')}
							file={coverFile}
							existingUrl={removeCover ? null : existingCover}
							onPick={(file) => {
								setCoverFile(file)
								setRemoveCover(false)
							}}
							onClear={() => {
								setCoverFile(null)
								setRemoveCover(Boolean(existingCover))
							}}
						/>
					</div>

					<div>
						<span className={LABEL}>{t('form.gallery', { max: UPLOAD_LIMITS.galleryMax })}</span>
						<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
							{existingGallery
								.filter((m) => !removedGalleryIds.includes(m.id))
								.map((m) => (
									<li key={m.id} className="relative">
										<img src={assetUrl(m.url)} alt="" className="aspect-square w-full rounded-lg object-cover" />
										<button
											type="button"
											onClick={() => setRemovedGalleryIds((prev) => [...prev, m.id])}
											aria-label={t('common.remove')}
											className="absolute right-1 top-1 rounded-full bg-[var(--wc-bg)]/90 px-2 text-sm text-[var(--wc-paprika)]"
										>
											×
										</button>
									</li>
								))}
							{galleryFiles.map((file, i) => (
								<GalleryThumb key={`${file.name}-${i}`} file={file} onRemove={() => setGalleryFiles((prev) => prev.filter((_, j) => j !== i))} />
							))}
						</ul>
						<input
							ref={galleryInputRef}
							type="file"
							multiple
							accept={UPLOAD_LIMITS.imageTypes.join(',')}
							className="hidden"
							aria-label={t('form.addGallery')}
							onChange={(e) => {
								handleGalleryPicked(e.target.files)
								e.target.value = ''
							}}
						/>
						<button
							type="button"
							disabled={galleryRoom <= 0}
							onClick={() => galleryInputRef.current?.click()}
							className={`${SECONDARY_BTN} mt-2 disabled:opacity-40`}
						>
							{t('form.addGallery')}
						</button>
					</div>

					<div>
						<span className={LABEL}>{t('form.video')}</span>
						<input
							ref={videoInputRef}
							type="file"
							accept={mediaAccept}
							className="hidden"
							aria-label={t('form.chooseVideo')}
							onChange={(e) => {
								handleVideoPicked(e.target.files?.[0])
								e.target.value = ''
							}}
						/>
						<div className="flex flex-wrap items-center gap-3">
							<button type="button" onClick={() => videoInputRef.current?.click()} className={SECONDARY_BTN}>
								{videoFile || (existingVideo && !removeVideo) ? t('form.replaceVideo') : t('form.chooseVideo')}
							</button>
							{(videoFile || (existingVideo && !removeVideo)) && (
								<>
									<span className="max-w-[16rem] truncate text-xs text-[var(--wc-text-muted)]">
										{videoFile
											? `${videoFile.name} · ${(videoFile.size / (1024 * 1024)).toFixed(1)}MB`
											: t('form.videoPresent')}
									</span>
									<button
										type="button"
										onClick={() => {
											setVideoFile(null)
											setRemoveVideo(Boolean(existingVideo))
										}}
										className="text-sm text-[var(--wc-paprika)] hover:underline"
									>
										{t('common.remove')}
									</button>
								</>
							)}
						</div>
					</div>
				</section>

				<div className="flex flex-wrap items-center gap-4">
					<button
						type="submit"
						disabled={saving}
						className="rounded-full bg-[var(--wc-basil)] px-6 py-2.5 font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
					>
						{progress
							? t('form.uploading', { done: progress.done, total: progress.total })
							: saving
								? t('common.saving')
								: isEdit
									? t('form.saveChanges')
									: t('form.publish')}
					</button>
					{saving && !progress && <span className="text-xs text-[var(--wc-text-muted)]">{t('form.translating')}</span>}
				</div>
			</form>
		</div>
	)
}

export default RecipeForm
