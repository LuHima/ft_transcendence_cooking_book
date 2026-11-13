import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, getErrorMessage, qs } from '../api/client'
import { useLang } from '../lib/useLang'
import { DEFAULT_RECIPE_SORT, parseRecipeSort, type RecipeSortValue } from '../lib/recipeSort'
import Avatar from '../components/Avatar'
import ConfirmDialog from '../components/ConfirmDialog'
import FriendButton from '../components/FriendButton'
import Pagination from '../components/Pagination'
import RecipeCard from '../components/RecipeCard'
import RecipeSortSelect from '../components/RecipeSortSelect'
import { ReportButton } from '../components/ReportDialog'
import { RecipeGridSkeleton, Skeleton } from '../components/Skeleton'
import type { FriendshipStatus, Paginated, PublicUser, RecipeSummary } from '../types/models'

const PAGE_SIZE = 9

// profilo pubblico di un altro utente (GET /users/:id → PublicUserResponseDto):
// username, avatar, bio, contatori, friendship_status (calcolato dal backend rispetto all'utente loggato)
// wrapper: key={id} rimonta il componente al cambio utente, così lo stato riparte pulito
function UserProfile() {
	const { id } = useParams()
	return <UserProfileView key={id} id={id} />
}

function UserProfileView({ id }: { id?: string }) {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const navigate = useNavigate()
	const { user: me } = useAuth()
	const [profile, setProfile] = useState<PublicUser | null>(null)
	const [recipes, setRecipes] = useState<Paginated<RecipeSummary> | null>(null)
	const [page, setPage] = useState(1)
	const [sort, setSort] = useState<RecipeSortValue>(DEFAULT_RECIPE_SORT)
	const [error, setError] = useState<string | null>(null)
	const [confirmBlock, setConfirmBlock] = useState(false)

	useEffect(() => {
		let cancelled = false
		api
			.get<PublicUser>(`/users/${id}`)
			.then((p) => {
				if (cancelled) return
				// risposta vuota o non valida = utente inesistente
				if (!p || typeof p.id !== 'number') throw new ApiError(404, t('profile.notFound'))
				setProfile(p)
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof ApiError && err.status !== 404 ? err.message : t('profile.notFound'))
			})
		return () => {
			cancelled = true
		}
	}, [id, t])

	// ricettario dell'utente: GET /users/:id/recipes?page=&limit=&lang=&sort_by=&sort_order=
	const { sortBy, sortOrder } = parseRecipeSort(sort)
	useEffect(() => {
		let cancelled = false
		api
			.get<Paginated<RecipeSummary>>(
				`/users/${id}/recipes${qs({ page, limit: PAGE_SIZE, lang, sort_by: sortBy, sort_order: sortOrder })}`,
			)
			.then((r) => {
				if (!cancelled) setRecipes(r)
			})
			.catch((err) => {
				if (!cancelled) {
					setRecipes(null)
					setError((prev) => prev ?? getErrorMessage(err, t('myRecipes.loadError')))
				}
			})
		return () => {
			cancelled = true
		}
	}, [id, page, lang, sortBy, sortOrder, t])

	function updateFriendship(next: FriendshipStatus) {
		setProfile((prev) => {
			if (!prev) return prev
			const wasFriend = prev.friendship_status === 'friends'
			const isFriend = next === 'friends'
			const delta = isFriend === wasFriend ? 0 : isFriend ? 1 : -1
			return {
				...prev,
				friendship_status: next,
				friends_count: prev.friends_count != null ? Math.max(0, prev.friends_count + delta) : prev.friends_count,
			}
		})
	}

	// POST /users/:id/block: rimuove amicizie e richieste, nasconde profili e commenti in entrambe le direzioni
	async function blockUser() {
		if (!profile) return
		try {
			await api.post(`/users/${profile.id}/block`)
			toast.success(t('block.blocked', { name: profile.username }))
			navigate('/search', { replace: true })
		} catch (err) {
			toast.error(getErrorMessage(err, t('block.error')))
			setConfirmBlock(false)
		}
	}

	if (error && !profile) return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-paprika)]">{error}</p>
	if (!profile) {
		return (
			<div role="status" aria-busy="true" className="mx-auto max-w-5xl px-4 py-12">
				<div className="flex items-center gap-5">
					<Skeleton className="h-20 w-20 rounded-full" />
					<Skeleton className="h-8 w-48" />
				</div>
				<div className="mt-10">
					<RecipeGridSkeleton count={3} />
				</div>
			</div>
		)
	}

	const isMe = me?.id === profile.id
	const recipeCount = profile.recipes_count ?? recipes?.total
	const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')

	return (
		<div className="mx-auto max-w-5xl px-4 py-12">
			<div className="flex flex-wrap items-center gap-5">
				<Avatar username={profile.username} url={profile.avatar_url} className="h-20 w-20 text-3xl" />
				<div className="min-w-0 flex-1">
					<h1 className="truncate font-display text-3xl text-[var(--wc-text)]">{profile.username}</h1>
					{fullName && <p className="text-sm text-[var(--wc-text)]">{fullName}</p>}
					<p className="mt-1 text-sm text-[var(--wc-text-muted)]">
						{recipeCount != null && t('profile.recipesCount', { count: recipeCount })}
						{profile.friends_count != null && ` · ${t('profile.friendsCount', { count: profile.friends_count })}`}
						{profile.total_likes_received != null && ` · ${t('profile.likesReceived', { count: profile.total_likes_received })}`}
					</p>
				</div>
				{isMe ? (
					<Link to="/profile" className="rounded-full border border-[var(--wc-border)] px-5 py-2 text-sm hover:border-[var(--wc-basil)]">
						{t('profile.editMine')}
					</Link>
				) : (
					<FriendButton
						userId={profile.id}
						username={profile.username}
						status={profile.friendship_status}
						onChange={updateFriendship}
					/>
				)}
			</div>

			{profile.bio && (
				<p className="mt-4 max-w-2xl whitespace-pre-line break-words text-[var(--wc-text)]">{profile.bio}</p>
			)}

			{/* azioni di moderazione: segnala + blocca (solo per utenti loggati, non sul proprio profilo) */}
			{!isMe && me && (
				<div className="mt-3 flex items-center gap-4">
					<ReportButton targetType="user" targetId={profile.id} ownerId={profile.id} />
					<button
						type="button"
						onClick={() => setConfirmBlock(true)}
						className="text-xs text-[var(--wc-text-muted)] hover:text-[var(--wc-paprika)] hover:underline"
					>
						⊘ {t('block.button')}
					</button>
				</div>
			)}

			<div className="mt-10 flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-display text-xl text-[var(--wc-saffron)]">{t('profile.publishedRecipes')}</h2>
				<RecipeSortSelect
					value={sort}
					onChange={(v) => {
						setSort(v)
						setPage(1)
					}}
				/>
			</div>
			{!recipes ? (
				<div className="mt-4">
					<RecipeGridSkeleton count={3} />
				</div>
			) : recipes.items.length === 0 ? (
				<p className="mt-4 text-[var(--wc-text-muted)]">{t('profile.noRecipes')}</p>
			) : (
				<>
					<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{recipes.items.map((r) => (
							<RecipeCard key={r.id} recipe={r} />
						))}
					</div>
					<Pagination page={recipes.page} totalPages={recipes.total_pages} onChange={setPage} />
				</>
			)}

			{confirmBlock && (
				<ConfirmDialog
					title={t('block.confirmTitle', { name: profile.username })}
					confirmLabel={t('block.confirm')}
					danger
					onConfirm={blockUser}
					onClose={() => setConfirmBlock(false)}
				>
					<p>{t('block.confirmFriends')}</p>
					<p>{t('block.confirmHidden')}</p>
				</ConfirmDialog>
			)}
		</div>
	)
}

export default UserProfile
