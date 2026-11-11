import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, assetUrl, getErrorMessage, qs } from '../api/client'
import { useLang } from '../lib/useLang'
import Comments from '../components/Comments'
import Avatar from '../components/Avatar'
import { ReportButton } from '../components/ReportDialog'
import { canDeleteRecipe, canEditRecipe, isAdmin as isAdminUser, isStaff as isStaffUser } from '../lib/permissions'
import ConfirmDialog from '../components/ConfirmDialog'
import { RecipeDetailSkeleton } from '../components/Skeleton'
import { exportRecipePdf, formatQuantity, ingredientNote } from '../lib/recipePdf'
import type { RecipeDetail as RecipeDetailType, TranslationSource } from '../types/models'

const PROVENANCE_STYLE: Record<TranslationSource, string> = {
	author_original: 'border-[var(--wc-basil)] text-[var(--wc-basil)]',
	manual: 'border-[var(--wc-saffron)] text-[var(--wc-saffron)]',
	machine: 'border-[var(--wc-border)] text-[var(--wc-text-muted)]',
}

function InfoBox({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex min-h-16 flex-col justify-center rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4 py-2">
			<span className="text-xs text-[var(--wc-text-muted)]">{label}</span>
			<span className="text-sm font-medium text-[var(--wc-text)]">{children}</span>
		</div>
	)
}

function RecipeDetail() {
	const { id } = useParams()
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const { user } = useAuth()
	const navigate = useNavigate()
	const [recipe, setRecipe] = useState<RecipeDetailType | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [liking, setLiking] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [retrying, setRetrying] = useState(false)
	const [exporting, setExporting] = useState(false)
	const [reactivating, setReactivating] = useState(false)
	const [confirmPurge, setConfirmPurge] = useState(false)

	// si ricarica anche al cambio lingua dell'interfaccia: il backend restituisce i testi tradotti
	useEffect(() => {
		let cancelled = false
		api
			.get<RecipeDetailType>(`/recipes/${id}${qs({ lang })}`)
			.then((data) => {
				if (cancelled) return
				setRecipe(data)
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setError(err instanceof ApiError && err.status !== 404 ? err.message : t('recipe.notFound'))
			})
		return () => {
			cancelled = true
		}
	}, [id, lang, t])

	async function toggleLike() {
		if (!recipe) return
		if (!user) return navigate('/login')
		setLiking(true)
		try {
			if (recipe.is_liked) {
				await api.delete(`/recipes/${recipe.id}/like`)
				setRecipe({ ...recipe, is_liked: false, likes_count: Math.max(0, recipe.likes_count - 1) })
			} else {
				await api.post(`/recipes/${recipe.id}/like`)
				setRecipe({ ...recipe, is_liked: true, likes_count: recipe.likes_count + 1 })
			}
		} catch (err) {
			toast.error(getErrorMessage(err, t('recipe.likeError')))
		} finally {
			setLiking(false)
		}
	}

	async function handleDelete() {
		if (!recipe) return
		const moderation = isAdmin && !isOwner
		if (!confirm(moderation ? t('recipe.confirmDeleteAdmin') : t('recipe.confirmDelete'))) return
		setDeleting(true)
		try {
			await api.delete(`/recipes/${recipe.id}`)
			toast.success(t('recipe.deleted'))
			navigate(moderation ? '/admin' : '/my-recipes')
		} catch (err) {
			toast.error(getErrorMessage(err, t('recipe.deleteError')))
			setDeleting(false)
		}
	}

	// PATCH /recipes/:id { is_active: true }: solo moderatori e admin possono riattivare una ricetta sospesa
	async function reactivate() {
		if (!recipe) return
		setReactivating(true)
		try {
			await api.patch(`/recipes/${recipe.id}`, { is_active: true })
			setRecipe({ ...recipe, is_active: true })
			toast.success(t('recipe.reactivated'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('recipe.reactivateError')))
		} finally {
			setReactivating(false)
		}
	}

	// DELETE /recipes/:id?hard=true: eliminazione definitiva, solo admin
	async function purge() {
		if (!recipe) return
		try {
			await api.delete(`/recipes/${recipe.id}${qs({ hard: 'true' })}`)
			toast.success(t('recipe.purged'))
			navigate('/admin')
		} catch (err) {
			toast.error(getErrorMessage(err, t('recipe.deleteError')))
			setConfirmPurge(false)
		}
	}

	async function retryTranslation() {
		if (!recipe) return
		setRetrying(true)
		try {
			await api.post(`/recipes/${recipe.id}/translate`)
			toast.success(t('recipe.retryTranslationOk'))
			const fresh = await api.get<RecipeDetailType>(`/recipes/${recipe.id}${qs({ lang })}`)
			setRecipe(fresh)
		} catch (err) {
			toast.error(getErrorMessage(err, t('recipe.retryTranslationError')))
		} finally {
			setRetrying(false)
		}
	}

	async function handleExportPdf() {
		if (!recipe) return
		setExporting(true)
		try {
			await exportRecipePdf(recipe, t)
		} catch {
			toast.error(t('recipe.exportPdfError'))
		} finally {
			setExporting(false)
		}
	}

	if (error && !recipe) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-16">
				<p className="text-[var(--wc-paprika)]">{error}</p>
				<Link to="/search" className="mt-4 inline-block text-sm text-[var(--wc-saffron)] hover:underline">
					{t('recipe.backToRecipes')}
				</Link>
			</div>
		)
	}
	if (!recipe) return <RecipeDetailSkeleton />

	const isOwner = Boolean(user && recipe.author && recipe.author.id === user.id)
	const isAdmin = isAdminUser(user)
	const isStaff = isStaffUser(user)
	const suspended = recipe.is_active === false
	const provenance = recipe.translation_source
	// proprietario o admin modificano / eliminano; il moderatore elimina solo dalla coda segnalazioni
	const canEdit = canEditRecipe(user, recipe.author?.id)
	const canDelete = canDeleteRecipe(user, recipe.author?.id)
	const canManage = canEdit || canDelete
	const author = recipe.author

	const cover = assetUrl(recipe.cover_image_url)
	const gallery = recipe.media.filter((m) => m.media_type === 'image')
	const video = assetUrl(recipe.video_url)
	const steps = [...recipe.steps].sort((a, b) => a.step_number - b.step_number)
	const translatedFromOtherLang = recipe.resolved_lang !== lang

	return (
		<div className="mx-auto max-w-3xl px-4 py-12">
			{suspended && (
				<div
					role="alert"
					className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[var(--wc-paprika)] bg-[var(--wc-surface)] px-4 py-3 text-sm text-[var(--wc-text)]"
				>
					<span>
						<span className="font-semibold text-[var(--wc-paprika)]">⚠ {t('recipe.suspendedTitle')}</span>{' '}
						{t('recipe.suspendedText')}
					</span>
					{isStaff && (
						<button
							onClick={reactivate}
							disabled={reactivating}
							className="rounded-full bg-[var(--wc-basil)] px-4 py-1.5 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
						>
							{reactivating ? t('common.sending') : t('recipe.reactivate')}
						</button>
					)}
				</div>
			)}
			{cover && (
				<img src={cover} alt={recipe.title} className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover" />
			)}
			{gallery.length > 0 && (
				<div className="mb-6 grid grid-cols-3 gap-2">
					{gallery.map((m) => (
						<img
							key={m.id}
							src={assetUrl(m.url)}
							alt={recipe.title}
							loading="lazy"
							className="aspect-square w-full rounded-xl object-cover"
						/>
					))}
				</div>
			)}

			<div className="flex items-start justify-between gap-4">
				<h1 className="font-display text-4xl text-[var(--wc-text)]">{recipe.title}</h1>
				<button
					onClick={toggleLike}
					disabled={liking}
					aria-pressed={recipe.is_liked}
					aria-label={t('recipe.likes', { count: recipe.likes_count })}
					className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
						recipe.is_liked
							? 'border-[var(--wc-saffron)] bg-[var(--wc-saffron)] text-[var(--wc-bg)]'
							: 'border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-saffron)]'
					}`}
				>
					♥ {recipe.likes_count}
				</button>
			</div>

			{recipe.tags.length > 0 && (
				<ul className="mt-3 flex flex-wrap gap-2">
					{recipe.tags.map((tag) => (
						<li
							key={tag.id}
							className="rounded-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-1 text-xs text-[var(--wc-text-muted)]"
						>
							{tag.name}
						</li>
					))}
				</ul>
			)}

			<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
				<InfoBox label={t('recipe.course')}>{t(`course.${recipe.course}`)}</InfoBox>
				<InfoBox label={t('recipe.difficulty')}>{t(`difficulty.${recipe.difficulty}`)}</InfoBox>
				<InfoBox label={t('recipe.servings')}>{recipe.servings}</InfoBox>
				<InfoBox label={t('recipe.prepTime')}>{t('recipe.minutes', { count: recipe.prep_time })}</InfoBox>
				<InfoBox label={t('recipe.cookTime')}>{t('recipe.minutes', { count: recipe.cook_time })}</InfoBox>
				<InfoBox label={t('recipe.publishedBy')}>
					{author ? (
						<Link
							to={`/users/${author.id}`}
							className="flex items-center gap-2 hover:text-[var(--wc-saffron)]"
						>
							<Avatar username={author.username} url={author.avatar_url} className="h-5 w-5 text-[10px]" />
							<span className="truncate">{author.username}</span>
						</Link>
					) : (
						<span>{t('recipe.platformName')}</span>
					)}
				</InfoBox>
			</div>
			<p className="mt-2 text-xs text-[var(--wc-text-muted)]">
				{t('recipe.totalTime', { count: recipe.total_time })}
				{' · '}
				{t('recipe.writtenIn', { lang: t(`lang.${recipe.source_lang}`) })}
				{translatedFromOtherLang && ` · ${t('recipe.shownIn', { lang: t(`lang.${recipe.resolved_lang}`) })}`}
				{provenance && (
					<span
						className={`ml-2 inline-block rounded-full border px-2 py-0.5 align-middle text-[10px] uppercase tracking-wide ${PROVENANCE_STYLE[provenance]}`}
						title={t(`recipe.provenance.${provenance}Help`)}
					>
						{t(`recipe.provenance.${provenance}`)}
					</span>
				)}
			</p>
			{provenance === 'machine' && recipe.translation_status !== 'failed' && (canManage || canEdit) && (
				<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--wc-text-muted)]">
					<span>{t('recipe.provenance.machineActions')}</span>
					{canManage && (
						<button
							onClick={retryTranslation}
							disabled={retrying}
							className="rounded-full border border-[var(--wc-border)] px-3 py-1 hover:border-[var(--wc-basil)] disabled:opacity-50"
						>
							{retrying ? t('common.sending') : t('recipe.retranslate')}
						</button>
					)}
					{canEdit && (
						<Link
							to={`/my-recipes/${recipe.id}/edit`}
							className="rounded-full border border-[var(--wc-border)] px-3 py-1 hover:border-[var(--wc-basil)]"
						>
							{t('recipe.suggestEdits')}
						</Link>
					)}
				</div>
			)}

			{recipe.translation_status === 'failed' && (
				<div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--wc-saffron)] px-4 py-3 text-sm text-[var(--wc-text)]">
					<span>{t('recipe.translationFailed')}</span>
					{canManage && (
						<button
							onClick={retryTranslation}
							disabled={retrying}
							className="rounded-full border border-[var(--wc-border)] px-3 py-1 hover:border-[var(--wc-basil)] disabled:opacity-50"
						>
							{retrying ? t('common.sending') : t('recipe.retryTranslation')}
						</button>
					)}
				</div>
			)}

			<div className="mt-4 flex flex-wrap items-center gap-3">
				<button
					onClick={handleExportPdf}
					disabled={exporting}
					className="rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm hover:border-[var(--wc-basil)] disabled:opacity-50"
				>
					{exporting ? t('recipe.exportingPdf') : t('recipe.exportPdf')}
				</button>
				{canEdit && <Link
					to={`/my-recipes/${recipe.id}/edit`}
					className="rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm hover:border-[var(--wc-basil)]"
				>
					{t('recipe.edit')}
				</Link>}
				{canDelete && <button
					onClick={handleDelete}
					disabled={deleting}
					className="rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-50"
				>
					{isAdmin && !isOwner ? t('recipe.removeAdmin') : t('common.delete')}
				</button>}
				{isAdmin && (
					<button
						onClick={() => setConfirmPurge(true)}
						className="rounded-full border border-[var(--wc-paprika)] px-4 py-1.5 text-sm font-medium text-[var(--wc-paprika)] hover:bg-[var(--wc-paprika)] hover:text-[var(--wc-bg)]"
					>
						{t('recipe.purge')}
					</button>
				)}
				{!isOwner && (canManage || (user && author)) && (
					<ReportButton targetType="recipe" targetId={recipe.id} ownerId={author?.id ?? null} />
				)}
			</div>

			<p className="mt-6 whitespace-pre-line text-[var(--wc-text)]">{recipe.description}</p>

			{video && (
				<video src={video} controls preload="metadata" className="mt-6 w-full rounded-2xl bg-black" />
			)}

			<section className="mt-8">
				<h2 className="font-display text-xl text-[var(--wc-saffron)]">{t('recipe.ingredients')}</h2>
				{recipe.ingredients.length > 0 ? (
					<ul className="mt-3 space-y-1 text-[var(--wc-text)]">
						{recipe.ingredients.map((ing) => {
							const note = ingredientNote(ing.notes)
							return (
								<li key={ing.id} className="flex gap-2">
									<span className="w-28 shrink-0 text-[var(--wc-text-muted)]">
										{formatQuantity(ing.quantity)} {t(`unit.${ing.unit}`)}
									</span>
									<span>
										{ing.name}
										{note && <span className="text-[var(--wc-text-muted)]"> ({note})</span>}
									</span>
								</li>
							)
						})}
					</ul>
				) : (
					<p className="mt-3 text-sm text-[var(--wc-text-muted)]">{t('recipe.noIngredients')}</p>
				)}
			</section>

			<section className="mt-8">
				<h2 className="font-display text-xl text-[var(--wc-saffron)]">{t('recipe.preparation')}</h2>
				<ol className="mt-4 space-y-6">
					{steps.map((step) => (
						<li key={step.id} className="flex gap-4">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wc-basil)] text-sm font-semibold text-[var(--wc-bg)]">
								{step.step_number}
							</span>
							<div className="min-w-0 flex-1">
								{step.title && <h3 className="font-medium text-[var(--wc-text)]">{step.title}</h3>}
								<p className="whitespace-pre-line text-[var(--wc-text)]">{step.description}</p>
								{step.duration != null && step.duration > 0 && (
									<p className="mt-1 text-xs text-[var(--wc-text-muted)]">
										⏱ {t('recipe.minutes', { count: step.duration })}
									</p>
								)}
								{step.image_url && (
									<img
										src={assetUrl(step.image_url)}
										alt={step.title ?? t('recipe.stepImageAlt', { n: step.step_number })}
										loading="lazy"
										className="mt-3 max-h-80 w-full rounded-xl object-cover"
									/>
								)}
							</div>
						</li>
					))}
				</ol>
			</section>

			{recipe.tips && (
				<section className="mt-8 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-5">
					<h2 className="font-display text-xl text-[var(--wc-saffron)]">{t('recipe.tips')}</h2>
					<p className="mt-2 whitespace-pre-line text-[var(--wc-text)]">{recipe.tips}</p>
				</section>
			)}

			{recipe.preservation && (
				<section className="mt-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-5">
					<h2 className="font-display text-xl text-[var(--wc-saffron)]">{t('recipe.preservation')}</h2>
					<p className="mt-2 whitespace-pre-line text-[var(--wc-text)]">{recipe.preservation}</p>
				</section>
			)}

			<Comments key={recipe.id} recipeId={recipe.id} recipeAuthorId={author?.id ?? null} />

			{confirmPurge && (
				<ConfirmDialog
					title={t('recipe.purgeTitle')}
					confirmLabel={t('recipe.purge')}
					danger
					onConfirm={purge}
					onClose={() => setConfirmPurge(false)}
				>
					<p>{t('recipe.purgeText', { title: recipe.title })}</p>
				</ConfirmDialog>
			)}
		</div>
	)
}

export default RecipeDetail
