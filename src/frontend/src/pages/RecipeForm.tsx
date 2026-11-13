import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, assetUrl, getErrorMessage, qs, uploadWithProgress, VIDEO_UPLOAD_TIMEOUT_MS } from '../api/client'
import { UPLOAD_LIMITS } from '../config'
import { SUPPORTED_LANGS } from '../i18n'
import { IMAGE_ACCEPT, VIDEO_ACCEPT, validateImage, validateVideo } from '../lib/files'
import { useLang } from '../lib/useLang'
import { useObjectUrl } from '../lib/useObjectUrl'
import IngredientPicker from '../components/IngredientPicker'
import ConfirmDialog from '../components/ConfirmDialog'
import { PROVENANCE_STYLE, provenanceOf } from '../lib/provenance'
import { Skeleton } from '../components/Skeleton'
import type {
	CatalogIngredient,
	CatalogTag,
	Course,
	CreateRecipeBody,
	Lang,
	RecipeDetail,
	RecipeDifficulty,
	RecipePrivacy,
	Unit,
	AvailableLanguage,
} from '../types/models'
import { RECIPE_PRIVACIES } from '../types/models'

const COURSES: Course[] = ['appetizer', 'first_course', 'main_course', 'dessert', 'side_dish', 'drink', 'snack']
const DIFFICULTIES: RecipeDifficulty[] = ['easy', 'medium', 'hard']
const UNITS: Unit[] = ['g', 'kg', 'ml', 'cl', 'l', 'oz', 'lb', 'fl_oz', 'cup', 'tbsp', 'tsp', 'piece', 'pinch']

const FIELD_BASE =
	'rounded-lg border bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)] aria-[invalid=true]:border-[var(--wc-paprika)] border-[var(--wc-border)]'
// Fixed-width fields (quantity, unit) must not inherit w-full, or they squeeze the ingredient name
const FIELD = `w-full ${FIELD_BASE}`
const SELECT = `${FIELD} h-[42px]`
const LABEL = 'mb-1 block text-sm text-[var(--wc-text-muted)]'
const SECTION_TITLE = 'font-display text-xl text-[var(--wc-saffron)]'
const SECONDARY_BTN =
	'rounded-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4 py-2 text-sm font-medium text-[var(--wc-text)] transition-colors hover:border-[var(--wc-basil)] hover:text-[var(--wc-basil)]'

// Numbers are stored as strings in form state, so a field can be emptied without a zero reappearing
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

// Fingerprint of the localized fields only: detects unsaved edits before switching language
function localizedSnapshot(
	title: string,
	description: string,
	tips: string,
	preservation: string,
	steps: { title: string; description: string }[],
): string {
	return JSON.stringify([title, description, tips, preservation, steps.map((st) => [st.title, st.description])])
}

// Sum of step durations: empty or invalid values count as 0
function sumStepDurations(steps: { duration: string }[]): number {
	return steps.reduce((sum, st) => {
		const d = st.duration.trim()
		return /^\d+$/.test(d) ? sum + Number(d) : sum
	}, 0)
}

interface ExistingGalleryItem {
	id: number
	url: string
}

type FieldErrors = Record<string, string>

const DESCRIPTION_MAX_LENGTH = 1000

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

// Preview + buttons for a single image (cover or step photo)
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
				accept={IMAGE_ACCEPT}
				aria-label={label}
				className="hidden"
				onChange={(e) => {
					const picked = e.target.files?.[0]
					// Allows picking the same file again after removing it
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

// Stable React keys for dynamic rows (ingredients, steps)
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

	// ─── form state ───
	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [sourceLang, setSourceLang] = useState<Lang>(uiLang)
	// Edit mode: language of the text being edited (defaults to the source language; sent to the backend as `locale`)
	const [editLocale, setEditLocale] = useState<Lang>(uiLang)
	const [switchingLocale, setSwitchingLocale] = useState(false)
	const [course, setCourse] = useState<Course>('main_course')
	const [difficulty, setDifficulty] = useState<RecipeDifficulty>('easy')
	const [servings, setServings] = useState('4')
	const [prepTime, setPrepTime] = useState('15')
	const [cookTime, setCookTime] = useState('15')
	const [privacy, setPrivacy] = useState<RecipePrivacy>('public')
	const [tagIds, setTagIds] = useState<number[]>([])
	const [ingredients, setIngredients] = useState<IngredientRow[]>(() => [newIngredient()])
	const [steps, setSteps] = useState<StepRow[]>(() => [newStep()])
	const [tips, setTips] = useState('')
	const [preservation, setPreservation] = useState('')

	// ─── translations (edit mode only) ───
	// Provenance of every available language (author_original | machine | manual)
	const [availableLanguages, setAvailableLanguages] = useState<AvailableLanguage[]>([])
	// Explicit retranslation choice; null = default
	const [retranslateChoice, setRetranslateChoice] = useState<boolean | null>(null)
	// Snapshot of the localized text (title, description, tips, storage, steps) at the last load
	const [localizedBaseline, setLocalizedBaseline] = useState('')
	// Language the user wants to switch to while having unsaved edits (opens the confirmation)
	const [pendingLocale, setPendingLocale] = useState<Lang | null>(null)
	// Step-duration warning dismissed by the user for this session
	const [durationWarningDismissed, setDurationWarningDismissed] = useState(false)

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

	const [catalog, setCatalog] = useState<CatalogIngredient[]>([])
	const [tagCatalog, setTagCatalog] = useState<CatalogTag[]>([])
	const [catalogError, setCatalogError] = useState(false)
	const [errors, setErrors] = useState<FieldErrors>({})
	const [loading, setLoading] = useState(isEdit)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [forbidden, setForbidden] = useState(false)
	const [saving, setSaving] = useState(false)
	// Media upload progress after saving: job number, current file and overall percentage (by bytes)
	const [progress, setProgress] = useState<{ done: number; total: number; label: string; percent: number } | null>(null)

	// While saving and uploading media: the browser warns before closing or reloading the page
	useEffect(() => {
		if (!saving) return
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault()
			e.returnValue = ''
		}
		window.addEventListener('beforeunload', onBeforeUnload)
		return () => window.removeEventListener('beforeunload', onBeforeUnload)
	}, [saving])

	// ─── catalog ───
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

	// ─── load the recipe to edit ───
	useEffect(() => {
		if (!id || !user) return
		let cancelled = false

		async function load() {
			let recipe = await api.get<RecipeDetail>(`/recipes/${id}${qs({ lang: uiLang })}`)
			// Always edit in the source language, so the saved text stays consistent with source_lang
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
			if (recipe.privacy) setPrivacy(recipe.privacy)
			setAvailableLanguages(recipe.available_languages ?? [])
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
			setLocalizedBaseline(
				localizedSnapshot(
					recipe.title,
					recipe.description,
					recipe.tips ?? '',
					recipe.preservation ?? '',
					[...recipe.steps].sort((a, b) => a.step_number - b.step_number).map((st) => ({ title: st.title ?? '', description: st.description })),
				),
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
		// eslint-disable-next-line react-hooks/exhaustive-deps -- load the recipe once per id/user, not on every language change
	}, [id, user])

	// Did the localized text change since the last load? (times, ingredients, tags and media don't count)
	const localizedDirty =
		isEdit &&
		localizedBaseline !== '' &&
		localizedSnapshot(title, description, tips, preservation, steps) !== localizedBaseline

	// Switching the edit language: ask for confirmation first when there are unsaved text edits
	function switchEditLocale(next: Lang) {
		if (!id || next === editLocale) return
		if (localizedDirty) {
			setPendingLocale(next)
			return
		}
		void loadEditLocale(next)
	}

	// Reloads only the localized text (title, description, steps, tips…) and resets the comparison baseline
	async function loadEditLocale(next: Lang) {
		setSwitchingLocale(true)
		try {
			const r = await api.get<RecipeDetail>(`/recipes/${id}${qs({ lang: next })}`)
			if (r.resolved_lang !== next) {
				toast.info(t('form.localeUnavailable', { lang: t(`lang.${next}`) }))
				return
			}
			const translated = [...r.steps].sort((a, b) => a.step_number - b.step_number)
			const nextSteps = steps.map((row, i) =>
				translated[i] ? { ...row, title: translated[i].title ?? '', description: translated[i].description } : row,
			)
			setTitle(r.title)
			setDescription(r.description)
			setTips(r.tips ?? '')
			setPreservation(r.preservation ?? '')
			setSteps(nextSteps)
			if (r.available_languages) setAvailableLanguages(r.available_languages)
			setLocalizedBaseline(localizedSnapshot(r.title, r.description, r.tips ?? '', r.preservation ?? '', nextSteps))
			setEditLocale(next)
			setErrors({})
		} catch (err) {
			toast.error(getErrorMessage(err, t('form.errors.saveFailed')))
		} finally {
			setSwitchingLocale(false)
		}
	}

	// ─── update helpers ───
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

	// Rows repeating an ingredient already listed above (the backend rejects duplicate ingredients)
	const duplicateKeys = new Set<number>()
	{
		const seen = new Set<number>()
		for (const row of ingredients) {
			if (!row.ingredient) continue
			if (seen.has(row.ingredient.id)) duplicateKeys.add(row.key)
			else seen.add(row.ingredient.id)
		}
	}

	// ─── validation ───
	function validate(): FieldErrors {
		const e: FieldErrors = {}
		const num = (v: string) => (v.trim() === '' ? NaN : Number(v))

		if (title.trim().length < 3 || title.trim().length > 255) e.title = t('form.errors.title')
		if (description.trim().length < 10) e.description = t('form.errors.description')
		else if (description.trim().length > DESCRIPTION_MAX_LENGTH)
			e.description = t('form.errors.descriptionMax', { max: DESCRIPTION_MAX_LENGTH })
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

	// ─── submit ───
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
			privacy,
		}

		setSaving(true)
		let saved: RecipeDetail
		try {
			saved = isEdit
				? await api.patch<RecipeDetail>(`/recipes/${id}${editLocale === sourceLang && retranslate ? qs({ retranslate: true }) : ''}`, {
						...body,
						locale: editLocale,
					})
				: await api.post<RecipeDetail>('/recipes', body)
		} catch (err) {
			// 400 = validation error, or text language not matching the declared one (LibreTranslate check)
			toast.error(getErrorMessage(err, t('form.errors.saveFailed')))
			setSaving(false)
			return
		}

		// ─── media: dedicated requests after saving ───
		// Each job has a label and a byte weight (0 for removals) to compute the overall progress
		interface MediaJob {
			label: string
			// Label shown once the bytes are sent while the server is still processing (video compression)
			processingLabel?: string
			bytes: number
			run: (onBytes: (loaded: number) => void) => Promise<unknown>
		}
		const jobs: MediaJob[] = []
		const rid = saved.id
		const upload = (
			label: string,
			path: string,
			field: string,
			files: File[],
			opts: { timeoutMs?: number; processingLabel?: string } = {},
		): MediaJob => ({
			label,
			processingLabel: opts.processingLabel,
			bytes: files.reduce((sum, f) => sum + f.size, 0),
			run: (onBytes) => {
				const fd = new FormData()
				files.forEach((f) => fd.append(field, f))
				return uploadWithProgress(path, fd, (loaded) => onBytes(loaded), { timeoutMs: opts.timeoutMs })
			},
		})
		const removal = (label: string, path: string): MediaJob => ({ label, bytes: 0, run: () => api.delete(path) })

		if (isEdit) {
			if (removeCover && !coverFile && existingCover) jobs.push(removal(t('form.cover'), `/recipes/${rid}/cover`))
			if (removeVideo && !videoFile && existingVideo) jobs.push(removal(t('form.video'), `/recipes/${rid}/video`))
			removedGalleryIds.forEach((mid) => jobs.push(removal(t('form.galleryLabel'), `/recipes/${rid}/gallery/${mid}`)))
		}
		if (coverFile) jobs.push(upload(t('form.cover'), `/recipes/${rid}/cover`, 'file', [coverFile]))
		if (galleryFiles.length) jobs.push(upload(t('form.galleryLabel'), `/recipes/${rid}/gallery`, 'files', galleryFiles))
		// The backend compresses the video with FFmpeg before replying: long timeout and a dedicated message
		if (videoFile) {
			jobs.push(
				upload(t('form.uploadingVideo'), `/recipes/${rid}/video`, 'file', [videoFile], {
					timeoutMs: VIDEO_UPLOAD_TIMEOUT_MS,
					processingLabel: t('form.optimizingVideo'),
				}),
			)
		}
		steps.forEach((s, i) => {
			const n = i + 1
			if (isEdit && s.removeExistingImage && !s.imageFile && s.existingImageUrl) {
				jobs.push(removal(t('form.stepN', { n }), `/recipes/${rid}/steps/${n}/image`))
			}
			if (s.imageFile) jobs.push(upload(t('form.stepN', { n }), `/recipes/${rid}/steps/${n}/image`, 'file', [s.imageFile]))
		})

		let failed = 0
		if (jobs.length) {
			const totalBytes = jobs.reduce((sum, j) => sum + j.bytes, 0)
			let finishedBytes = 0
			// With no bytes to send (removals only) progress advances by job count
			const percentOf = (i: number, current: number) =>
				totalBytes > 0 ? Math.min(100, Math.round(((finishedBytes + current) / totalBytes) * 100)) : Math.round((i / jobs.length) * 100)
			for (let i = 0; i < jobs.length; i++) {
				const job = jobs[i]
				setProgress({ done: i, total: jobs.length, label: job.label, percent: percentOf(i, 0) })
				try {
					await job.run((loaded) =>
						setProgress({
							done: i,
							total: jobs.length,
							// Upload finished but no response yet: the server is processing
							label: job.processingLabel && loaded >= job.bytes ? job.processingLabel : job.label,
							percent: percentOf(i, Math.min(loaded, job.bytes)),
						}),
					)
				} catch {
					failed++
				}
				finishedBytes += job.bytes
				setProgress({ done: i + 1, total: jobs.length, label: job.label, percent: percentOf(i + 1, 0) })
			}
		}

		setSaving(false)
		setProgress(null)
		if (failed > 0) toast.error(t('form.mediaPartial', { count: failed }))
		else toast.success(isEdit ? t('form.updated') : t('form.created'))
		navigate(`/recipes/${rid}`)
	}

	// ─── page states ───
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
	// Non-blocking warning: steps may run in parallel, so saving is still allowed
	const stepsDurationSum = sumStepDurations(steps)
	const showDurationWarning = !durationWarningDismissed && totalTime > 0 && stepsDurationSum > totalTime

	// Provenance of the language being edited (edit mode only)
	const editProvenance = isEdit ? provenanceOf(editLocale, sourceLang, availableLanguages) : null
	// Languages a retranslation would update: machine-translated or not translated yet
	const retranslatable = SUPPORTED_LANGS.filter((l) => l !== sourceLang).filter((l) => {
		const prov = provenanceOf(l, sourceLang, availableLanguages)
		return prov === null || prov === 'machine'
	})
	const canRetranslate = retranslatable.length > 0
	// Default: on when there is something to retranslate; off and disabled when every other language is manually curated
	const retranslate = canRetranslate && (retranslateChoice ?? true)
	const mediaAccept = VIDEO_ACCEPT

	return (
		<div className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{isEdit ? t('form.editTitle') : t('form.newTitle')}</h1>

			<form onSubmit={handleSubmit} noValidate className="mt-8 space-y-8">
				{/* ─── general info ─── */}
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
								{SUPPORTED_LANGS.map((l) => {
									// In edit mode every language shows its provenance (original, curated, machine, not translated)
									const prov = isEdit ? provenanceOf(l, sourceLang, availableLanguages) : undefined
									return (
										<option key={l} value={l}>
											{t(`lang.${l}`)}
											{prov !== undefined && ` · ${t(`form.provenanceOption.${prov ?? 'missing'}`)}`}
										</option>
									)
								})}
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

					{/* Provenance of the edited language and automatic retranslation */}
					{isEdit && (
						<div className="space-y-3 rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-3 text-sm">
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-xs text-[var(--wc-text-muted)]">{t('form.provenanceLabel', { lang: t(`lang.${editLocale}`) })}</span>
								{editProvenance ? (
									<span
										className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${PROVENANCE_STYLE[editProvenance]}`}
									>
										{t(`recipe.provenance.${editProvenance}`)}
									</span>
								) : (
									<span className="text-xs text-[var(--wc-text-muted)]">{t('form.provenanceOption.missing')}</span>
								)}
							</div>
							{editProvenance && <p className="text-xs text-[var(--wc-text-muted)]">{t(`form.provenanceHelp.${editProvenance}`)}</p>}
							{editLocale !== sourceLang && editProvenance === 'machine' && (
								<p className="rounded-lg border-l-4 border-[var(--wc-saffron)] bg-[var(--wc-bg)] px-3 py-2 text-xs text-[var(--wc-text)]">
									{t('form.machinePromotionNote')}
								</p>
							)}
							{editLocale === sourceLang && (
								<div>
									<label className={`flex items-start gap-2 ${canRetranslate ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
										<input
											type="checkbox"
											className="mt-1"
											checked={retranslate}
											disabled={!canRetranslate}
											onChange={(e) => setRetranslateChoice(e.target.checked)}
										/>
										<span>
											<span className="block font-medium text-[var(--wc-text)]">{t('form.retranslate')}</span>
											<span className="block text-xs text-[var(--wc-text-muted)]">
												{canRetranslate
													? t('form.retranslateHelp', { langs: retranslatable.map((l) => t(`lang.${l}`)).join(', ') })
													: t('form.retranslateAllManual')}
											</span>
										</span>
									</label>
								</div>
							)}
						</div>
					)}

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
							maxLength={DESCRIPTION_MAX_LENGTH}
							aria-invalid={Boolean(errors.description)}
							onChange={(e) => setDescription(e.target.value)}
							className={FIELD}
						/>
						<p className="mt-1 text-right text-xs text-[var(--wc-text-muted)]">
							{description.length}/{DESCRIPTION_MAX_LENGTH}
						</p>
					</Field>
				</section>

				{/* ─── privacy ─── */}
				<section>
					<h2 className={SECTION_TITLE}>{t('form.visibility')}</h2>
					<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('form.visibility')}>
						{RECIPE_PRIVACIES.map((v) => (
							<label
								key={v}
								className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition-colors ${
									privacy === v
										? 'border-[var(--wc-basil)] bg-[var(--wc-surface-raised)]'
										: 'border-[var(--wc-border)] hover:border-[var(--wc-basil)]'
								}`}
							>
								<input
									type="radio"
									name="privacy"
									value={v}
									checked={privacy === v}
									onChange={() => setPrivacy(v)}
									className="sr-only"
								/>
								<span className="block font-medium text-[var(--wc-text)]">{t(`privacy.${v}`)}</span>
								<span className="block text-xs text-[var(--wc-text-muted)]">{t(`privacy.${v}Help`)}</span>
							</label>
						))}
					</div>
				</section>

				{/* ─── tags ─── */}
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

				{/* ─── ingredients ─── */}
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

				{/* ─── steps ─── */}
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
					{/* Non-blocking: shown when step durations exceed the total time (steps may run in parallel) */}
					{showDurationWarning && (
						<div
							role="status"
							className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--wc-saffron)] bg-[var(--wc-surface)] px-4 py-3 text-sm text-[var(--wc-text)]"
						>
							<span aria-hidden="true" className="text-[var(--wc-saffron)]">⏱</span>
							<p className="flex-1">
								{t('form.warnings.stepDurationExceedsTotal', { stepsSum: stepsDurationSum, totalTime })}
							</p>
							<button
								type="button"
								onClick={() => setDurationWarningDismissed(true)}
								aria-label={t('form.warnings.dismiss')}
								className="text-lg leading-none text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]"
							>
								×
							</button>
						</div>
					)}
					<button type="button" onClick={() => setSteps((prev) => [...prev, newStep()])} className={`mt-4 ${SECONDARY_BTN}`}>
						+ {t('form.addStep')}
					</button>
				</section>

				{/* ─── tips and storage ─── */}
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

				{/* ─── photos and video ─── */}
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
							accept={IMAGE_ACCEPT}
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
							? t('form.uploading', { done: Math.min(progress.done + 1, progress.total), total: progress.total })
							: saving
								? t('common.saving')
								: isEdit
									? t('form.saveChanges')
									: t('form.publish')}
					</button>
					{saving && !progress && <span className="text-xs text-[var(--wc-text-muted)]">{t('form.translating')}</span>}
				</div>

			</form>

			{/* Media upload after saving: an overlay covers the page so users don't navigate away while the server is still compressing the files */}
			{progress && (
				<div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4" role="alertdialog" aria-modal="true" aria-label={t('form.uploadProgress')}>
					<div className="w-full max-w-md space-y-3 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6" aria-live="polite">
						<h2 className="font-display text-xl text-[var(--wc-saffron)]">{t('form.uploadProgress')}</h2>
						<div className="flex justify-between gap-3 text-sm text-[var(--wc-text)]">
							<span className="min-w-0">
								{t('form.uploadingItem', { label: progress.label, done: Math.min(progress.done + 1, progress.total), total: progress.total })}
							</span>
							<span className="shrink-0 font-medium">{progress.percent}%</span>
						</div>
						<div
							role="progressbar"
							aria-label={t('form.uploadProgress')}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={progress.percent}
							className="h-2 w-full overflow-hidden rounded-full bg-[var(--wc-surface-raised)]"
						>
							<div
								className="h-full rounded-full bg-[var(--wc-basil)] transition-[width] duration-200"
								style={{ width: `${progress.percent}%` }}
							/>
						</div>
						<p className="text-xs text-[var(--wc-text-muted)]">{t('form.uploadKeepOpen')}</p>
					</div>
				</div>
			)}

			{/* Confirmation before switching language with unsaved text edits */}
			{pendingLocale && (
				<ConfirmDialog
					title={t('form.discardTitle')}
					confirmLabel={t('form.discardConfirm', { lang: t(`lang.${pendingLocale}`) })}
					danger
					onConfirm={() => {
						const next = pendingLocale
						setPendingLocale(null)
						void loadEditLocale(next)
					}}
					onClose={() => setPendingLocale(null)}
				>
					<p>{t('form.discardText', { from: t(`lang.${editLocale}`), to: t(`lang.${pendingLocale}`) })}</p>
				</ConfirmDialog>
			)}
		</div>
	)
}

export default RecipeForm
