import { useTranslation } from 'react-i18next'
import { RECIPE_SORT_OPTIONS, type RecipeSortValue } from '../lib/recipeSort'

const SELECT =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]'

// menu a tendina per l'ordinamento delle ricette (ricerca, profilo utente, le mie ricette)
function RecipeSortSelect({ value, onChange, id }: { value: RecipeSortValue; onChange: (v: RecipeSortValue) => void; id?: string }) {
	const { t } = useTranslation()
	return (
		<label className="flex items-center gap-2 text-sm text-[var(--wc-text-muted)]">
			{t('search.sortBy')}
			<select id={id} value={value} onChange={(e) => onChange(e.target.value as RecipeSortValue)} className={SELECT}>
				{RECIPE_SORT_OPTIONS.map((o) => (
					<option key={o.value} value={o.value}>
						{t(`search.sort.${o.label}`)}
					</option>
				))}
			</select>
		</label>
	)
}

export default RecipeSortSelect
