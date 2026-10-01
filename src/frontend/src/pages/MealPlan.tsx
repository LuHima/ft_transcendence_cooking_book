import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { MealPlan as MealPlanType, MealPlanEntry, MealType, Recipe } from '../types/models'

const MEAL_TYPES: { value: MealType; label: string }[] = [
	{ value: 'breakfast', label: 'Colazione' },
	{ value: 'lunch', label: 'Pranzo' },
	{ value: 'dinner', label: 'Cena' },
]

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function getMonday(date: Date) {
	const d = new Date(date)
	const day = d.getDay()
	const diff = d.getDate() - day + (day === 0 ? -6 : 1)
	d.setDate(diff)
	d.setHours(0, 0, 0, 0)
	return d
}

function toISODate(d: Date) {
	return d.toISOString().slice(0, 10)
}

function MealPlan() {
	const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
	const [entries, setEntries] = useState<MealPlanEntry[]>([])
	const [recipes, setRecipes] = useState<Pick<Recipe, 'id' | 'title'>[]>([])
	const [error, setError] = useState<string | null>(null)
	const [savingKey, setSavingKey] = useState<string | null>(null)

	const days = useMemo(
		() => Array.from({ length: 7 }, (_, i) => {
			const d = new Date(weekStart)
			d.setDate(d.getDate() + i)
			return d
		}),
		[weekStart],
	)

	useEffect(() => {
		api.get<Pick<Recipe, 'id' | 'title'>[]>('/recipes').then(setRecipes).catch(() => setRecipes([]))
	}, [])

	useEffect(() => {
		setError(null)
		// NB: si appoggia a GET /api/meal-plans?start=...&end=..., endpoint da esporre lato
		// backend a partire dai modelli MealPlan/MealPlanRecipe già presenti in Prisma.
		api
			.get<MealPlanType>(`/meal-plans?start=${toISODate(days[0])}&end=${toISODate(days[6])}`)
			.then((plan) => setEntries(plan?.meal_plan_recipes ?? []))
			.catch((err) => {
				setEntries([])
				setError(err instanceof ApiError ? err.message : 'Impossibile caricare il meal plan.')
			})
	}, [days])

	function entryFor(date: string, mealType: MealType) {
		return entries.find((e) => e.planned_date.slice(0, 10) === date && e.meal_type === mealType)
	}

	async function handleChange(date: string, mealType: MealType, recipeId: string) {
		const key = `${date}-${mealType}`
		setSavingKey(key)
		try {
			if (!recipeId) {
				await api.delete(`/meal-plans/entries?date=${date}&meal_type=${mealType}`)
				setEntries((prev) => prev.filter((e) => !(e.planned_date.slice(0, 10) === date && e.meal_type === mealType)))
			} else {
				const recipe = recipes.find((r) => r.id === Number(recipeId))
				await api.post('/meal-plans/entries', { planned_date: date, meal_type: mealType, recipe_id: Number(recipeId) })
				setEntries((prev) => [
					...prev.filter((e) => !(e.planned_date.slice(0, 10) === date && e.meal_type === mealType)),
					{ planned_date: date, meal_type: mealType, recipe_id: Number(recipeId), recipe_title: recipe?.title },
				])
			}
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Impossibile salvare la modifica.')
		} finally {
			setSavingKey(null)
		}
	}

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
				<h1 className="font-display text-3xl text-[var(--wc-saffron)]">Meal plan settimanale</h1>
				<div className="flex items-center gap-2 text-sm">
					<button
						onClick={() => setWeekStart((prev) => new Date(prev.getTime() - 7 * 86400000))}
						className="rounded-full border border-[var(--wc-border)] px-3 py-1 hover:border-[var(--wc-basil)]"
					>
						← Sett. prec.
					</button>
					<span className="text-[var(--wc-text-muted)]">
						{toISODate(days[0])} – {toISODate(days[6])}
					</span>
					<button
						onClick={() => setWeekStart((prev) => new Date(prev.getTime() + 7 * 86400000))}
						className="rounded-full border border-[var(--wc-border)] px-3 py-1 hover:border-[var(--wc-basil)]"
					>
						Sett. succ. →
					</button>
				</div>
			</div>

			{error && <p className="mb-4 text-[var(--wc-paprika)]">{error}</p>}

			<div className="overflow-x-auto rounded-2xl border border-[var(--wc-border)]">
				<table className="w-full min-w-[800px] border-collapse text-sm">
					<thead>
						<tr className="bg-[var(--wc-surface)]">
							<th className="p-3 text-left text-[var(--wc-text-muted)]">Pasto</th>
							{days.map((d, i) => (
								<th key={i} className="p-3 text-left text-[var(--wc-text-muted)]">
									{DAY_LABELS[i]} <span className="block text-xs font-normal">{toISODate(d).slice(5)}</span>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{MEAL_TYPES.map((meal) => (
							<tr key={meal.value} className="border-t border-[var(--wc-border)]">
								<td className="p-3 font-medium text-[var(--wc-text)]">{meal.label}</td>
								{days.map((d) => {
									const date = toISODate(d)
									const entry = entryFor(date, meal.value)
									const key = `${date}-${meal.value}`
									return (
										<td key={key} className="p-2 align-top">
											<select
												value={entry?.recipe_id ?? ''}
												disabled={savingKey === key}
												onChange={(e) => handleChange(date, meal.value, e.target.value)}
												className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2 py-1.5 text-xs outline-none focus:border-[var(--wc-basil)] disabled:opacity-50"
											>
												<option value="">—</option>
												{recipes.map((r) => (
													<option key={r.id} value={r.id}>
														{r.title}
													</option>
												))}
											</select>
										</td>
									)
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}

export default MealPlan
