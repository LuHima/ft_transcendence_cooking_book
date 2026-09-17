import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'
import type { IngredientInput, Recipe, RecipeDifficulty } from '../types/models'

const UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz', 'oz', 'lb', 'pinch', 'pz']
const DIFFICULTIES: { value: RecipeDifficulty; label: string }[] = [
	{ value: 'easy', label: 'Facile' },
	{ value: 'medium', label: 'Media' },
	{ value: 'hard', label: 'Difficile' },
]

const MAX_IMAGE_MB = 10
const MAX_VIDEO_MB = 100
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

function emptyIngredient(): IngredientInput {
	return { name: '', quantity: 1, unit: 'g' }
}

function RecipeForm() {
	const { id } = useParams()
	const isEdit = Boolean(id)
	const navigate = useNavigate()
	const { user } = useAuth()

	const [title, setTitle] = useState('')
	const [difficulty, setDifficulty] = useState<RecipeDifficulty>('easy')
	const [prepTime, setPrepTime] = useState(30)
	const [description, setDescription] = useState('')
	const [instructions, setInstructions] = useState('')
	const [ingredients, setIngredients] = useState<IngredientInput[]>([emptyIngredient()])
	const [mediaFiles, setMediaFiles] = useState<File[]>([])
	const [mediaError, setMediaError] = useState<string | null>(null)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [loading, setLoading] = useState(isEdit)
	const [submitting, setSubmitting] = useState(false)

	useEffect(() => {
		if (!id) return
		api
			.get<Recipe>(`/recipes/${id}`)
			.then((recipe) => {
				setTitle(recipe.title)
				setDifficulty(recipe.difficulty ?? 'easy')
				setPrepTime(recipe.prep_time ?? 30)
				setDescription(recipe.description ?? '')
				setInstructions(recipe.instructions ?? '')
				if (recipe.recipe_ingredients?.length) {
					setIngredients(
						recipe.recipe_ingredients.map((ri) => ({
							name: ri.ingredient.name,
							quantity: ri.quantity,
							unit: ri.unit,
						})),
					)
				}
			})
			.catch((err) => setSubmitError(err instanceof ApiError ? err.message : 'Ricetta non trovata.'))
			.finally(() => setLoading(false))
	}, [id])

	function updateIngredient(index: number, patch: Partial<IngredientInput>) {
		setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)))
	}

	function addIngredient() {
		setIngredients((prev) => [...prev, emptyIngredient()])
	}

	function removeIngredient(index: number) {
		setIngredients((prev) => prev.filter((_, i) => i !== index))
	}

	function handleFilesSelected(files: FileList | null) {
		if (!files) return
		setMediaError(null)
		const accepted: File[] = []

		for (const file of Array.from(files)) {
			const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type)
			const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type)

			if (!isImage && !isVideo) {
				setMediaError(`Formato non supportato: ${file.name}. Usa JPG, PNG, WEBP, MP4, WEBM o MOV.`)
				continue
			}
			const maxMb = isImage ? MAX_IMAGE_MB : MAX_VIDEO_MB
			if (file.size > maxMb * 1024 * 1024) {
				setMediaError(`${file.name} supera i ${maxMb}MB consentiti.`)
				continue
			}
			accepted.push(file)
		}
		setMediaFiles((prev) => [...prev, ...accepted])
	}

	function removeMediaFile(index: number) {
		setMediaFiles((prev) => prev.filter((_, i) => i !== index))
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setSubmitError(null)
		setSubmitting(true)

		try {
			const payload = {
				title,
				difficulty,
				prep_time: prepTime,
				description,
				instructions,
				owner_type: 'user' as const,
				ingredients: ingredients.filter((i) => i.name.trim()),
			}

			const recipe = isEdit
				? await api.patch<Recipe>(`/recipes/${id}`, payload)
				: await api.post<Recipe>('/recipes', payload)

			if (mediaFiles.length > 0) {
				const formData = new FormData()
				mediaFiles.forEach((file) => formData.append('media', file))
				// NB: endpoint di upload media da esporre lato backend (es. POST /api/recipes/:id/media),
				// che salva i file in recipe_media collegandoli alla ricetta appena creata/modificata.
				await api.post(`/recipes/${recipe.id}/media`, formData)
			}

			navigate(`/recipes/${recipe.id}`)
		} catch (err) {
			setSubmitError(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.')
		} finally {
			setSubmitting(false)
		}
	}

	if (loading) {
		return <div className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-text-muted)]">Caricamento…</div>
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">
				{isEdit ? 'Modifica ricetta' : 'Nuova ricetta'}
			</h1>

			<form onSubmit={handleSubmit} className="mt-8 space-y-6">
				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Titolo</label>
					<input
						required
						minLength={3}
						maxLength={30}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Difficoltà</label>
						<select
							value={difficulty}
							onChange={(e) => setDifficulty(e.target.value as RecipeDifficulty)}
							className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
						>
							{DIFFICULTIES.map((d) => (
								<option key={d.value} value={d.value}>
									{d.label}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Tempo di preparazione (min)</label>
						<input
							type="number"
							min={1}
							required
							value={prepTime}
							onChange={(e) => setPrepTime(Number(e.target.value))}
							className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
						/>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Autore</label>
					<input
						disabled
						value={user?.username ?? ''}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface-raised)] px-3 py-2 text-[var(--wc-text-muted)]"
					/>
				</div>

				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Descrizione</label>
					<textarea
						required
						minLength={25}
						maxLength={5000}
						rows={3}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>

				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Preparazione (passaggi)</label>
					<textarea
						required
						minLength={50}
						rows={6}
						value={instructions}
						onChange={(e) => setInstructions(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
						placeholder="Descrivi i passaggi della preparazione, almeno 50 caratteri."
					/>
				</div>

				<div>
					<div className="mb-2 flex items-center justify-between">
						<label className="text-sm text-[var(--wc-text-muted)]">Ingredienti</label>
						<button
							type="button"
							onClick={addIngredient}
							className="text-sm text-[var(--wc-saffron)] hover:underline"
						>
							+ Aggiungi ingrediente
						</button>
					</div>
					<div className="space-y-2">
						{ingredients.map((ing, index) => (
							<div key={index} className="flex gap-2">
								<input
									placeholder="Nome ingrediente"
									value={ing.name}
									onChange={(e) => updateIngredient(index, { name: e.target.value })}
									className="flex-1 rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
								/>
								<input
									type="number"
									min={0}
									step={0.1}
									value={ing.quantity}
									onChange={(e) => updateIngredient(index, { quantity: Number(e.target.value) })}
									className="w-24 rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 outline-none focus:border-[var(--wc-basil)]"
								/>
								<select
									value={ing.unit}
									onChange={(e) => updateIngredient(index, { unit: e.target.value })}
									className="w-28 rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2 py-2 outline-none focus:border-[var(--wc-basil)]"
								>
									{UNITS.map((u) => (
										<option key={u} value={u}>
											{u}
										</option>
									))}
								</select>
								<button
									type="button"
									onClick={() => removeIngredient(index)}
									disabled={ingredients.length === 1}
									className="rounded-lg border border-[var(--wc-border)] px-3 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-40"
								>
									×
								</button>
							</div>
						))}
					</div>
				</div>

				<div>
					<label className="mb-1 block text-sm text-[var(--wc-text-muted)]">Foto / Video</label>
					<input
						type="file"
						multiple
						accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
						onChange={(e) => handleFilesSelected(e.target.files)}
						className="block text-sm text-[var(--wc-text-muted)]"
					/>
					<p className="mt-1 text-xs text-[var(--wc-text-muted)]">
						Immagini JPG/PNG/WEBP fino a {MAX_IMAGE_MB}MB, video MP4/WEBM/MOV fino a {MAX_VIDEO_MB}MB.
					</p>
					{mediaError && <p className="mt-1 text-xs text-[var(--wc-paprika)]">{mediaError}</p>}

					{mediaFiles.length > 0 && (
						<ul className="mt-2 space-y-1">
							{mediaFiles.map((file, index) => (
								<li
									key={index}
									className="flex items-center justify-between rounded-lg border border-[var(--wc-border)] px-3 py-1.5 text-xs text-[var(--wc-text-muted)]"
								>
									<span>
										{file.name} · {(file.size / (1024 * 1024)).toFixed(1)}MB
									</span>
									<button
										type="button"
										onClick={() => removeMediaFile(index)}
										className="text-[var(--wc-paprika)]"
									>
										Rimuovi
									</button>
								</li>
							))}
						</ul>
					)}
				</div>

				{submitError && <p className="text-sm text-[var(--wc-paprika)]">{submitError}</p>}

				<button
					type="submit"
					disabled={submitting}
					className="rounded-full bg-[var(--wc-basil)] px-6 py-2.5 font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
				>
					{submitting ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Pubblica ricetta'}
				</button>
			</form>
		</div>
	)
}

export default RecipeForm
