import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, getErrorMessage, qs, toPage } from '../api/client'
import { useLang } from '../lib/useLang'
import { DEFAULT_RECIPE_SORT, parseRecipeSort, type RecipeSortValue } from '../lib/recipeSort'
import Avatar from '../components/Avatar'
import ConfirmDialog from '../components/ConfirmDialog'
import FriendButton from '../components/FriendButton'
import Pagination from '../components/Pagination'
import RecipeCard from '../components/RecipeCard'
import RecipeSortSelect from '../components/RecipeSortSelect'
import { ReportButton } from '../components/ReportDialog'
import { ListSkeleton, RecipeGridSkeleton, Skeleton } from '../components/Skeleton'
import type { FriendItem, FriendshipStatus, Paginated, PublicUser, RecipeSummary } from '../types/models'

const PAGE_SIZE = 9
const FRIENDS_PAGE_SIZE = 20

type Tab = 'recipes' | 'friends'

// accesso a una sezione del profilo negato dalla privacy: 401 = ospite (deve accedere), 403 = non autorizzato
type Restriction = 401 | 403

function restrictionOf(err: unknown): Restriction | null {
	return err instanceof ApiError && (err.status === 401 || err.status === 403) ? err.status : null
}

// profilo pubblico di un utente, raggiungibile da /users/:id oppure /u/:username (link condivisibile).
// GET /users/:id o GET /users/by-username/:username restituiscono il profilo completo o ridotto (degraded)
// in base a profile_privacy; ricettario e amici possono rispondere 401/403 (PROFILE_COOKBOOK_RESTRICTED,
// PROFILE_FRIENDS_RESTRICTED). Wrapper: key rimonta il componente al cambio utente, così lo stato riparte pulito.
function UserProfile() {
	const { id, username } = useParams()
	return <UserProfileView key={id ?? `u:${username}`} id={id} username={username} />
}

function UserProfileView({ id, username }: { id?: string; username?: string }) {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const navigate = useNavigate()
	const location = useLocation()
	const { user: me } = useAuth()
	const [profile, setProfile] = useState<PublicUser | null>(null)
	const [profileError, setProfileError] = useState<string | null>(null)
	const [tab, setTab] = useState<Tab>('recipes')
	const [confirmBlock, setConfirmBlock] = useState(false)

	// ricettario
	const [recipes, setRecipes] = useState<Paginated<RecipeSummary> | null>(null)
	const [recipesError, setRecipesError] = useState<string | null>(null)
	const [recipesRestricted, setRecipesRestricted] = useState<Restriction | null>(null)
	const [page, setPage] = useState(1)
	const [sort, setSort] = useState<RecipeSortValue>(DEFAULT_RECIPE_SORT)

	// amici confermati
	const [friends, setFriends] = useState<Paginated<FriendItem> | null>(null)
	const [friendsError, setFriendsError] = useState<string | null>(null)
	const [friendsRestricted, setFriendsRestricted] = useState<Restriction | null>(null)
	const [friendsPage, setFriendsPage] = useState(1)

	// profilo: per id oppure per username
	useEffect(() => {
		let cancelled = false
		const path = username ? `/users/by-username/${encodeURIComponent(username)}` : `/users/${id}`
		api
			.get<PublicUser>(path)
			.then((p) => {
				if (cancelled) return
				// risposta vuota o non valida = utente inesistente
				if (!p || typeof p.id !== 'number') throw new ApiError(404, t('profile.notFound'))
				setProfile(p)
			})
			.catch((err) => {
				if (!cancelled) setProfileError(err instanceof ApiError && err.status !== 404 ? err.message : t('profile.notFound'))
			})
		return () => {
			cancelled = true
		}
	}, [id, username, t])

	const profileId = profile?.id

	// ricettario: GET /users/:id/recipes (si usa sempre l'id restituito dal profilo)
	const { sortBy, sortOrder } = parseRecipeSort(sort)
	useEffect(() => {
		if (profileId == null) return
		let cancelled = false
		api
			.get<Paginated<RecipeSummary>>(
				`/users/${profileId}/recipes${qs({ page, limit: PAGE_SIZE, lang, sort_by: sortBy, sort_order: sortOrder })}`,
			)
			.then((r) => {
				if (cancelled) return
				setRecipes(r)
				setRecipesError(null)
				setRecipesRestricted(null)
			})
			.catch((err) => {
				if (cancelled) return
				setRecipes(null)
				const restriction = restrictionOf(err)
				setRecipesRestricted(restriction)
				setRecipesError(restriction ? null : getErrorMessage(err, t('myRecipes.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [profileId, page, lang, sortBy, sortOrder, t])

	// amici: GET /users/:id/friends, caricati solo aprendo la scheda
	useEffect(() => {
		if (profileId == null || tab !== 'friends') return
		let cancelled = false
		api
			.get<unknown>(`/users/${profileId}/friends${qs({ page: friendsPage, limit: FRIENDS_PAGE_SIZE })}`)
			.then((d) => {
				if (cancelled) return
				setFriends(toPage<FriendItem>(d, FRIENDS_PAGE_SIZE))
				setFriendsError(null)
				setFriendsRestricted(null)
			})
			.catch((err) => {
				if (cancelled) return
				setFriends(null)
				const restriction = restrictionOf(err)
				setFriendsRestricted(restriction)
				setFriendsError(restriction ? null : getErrorMessage(err, t('friends.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [profileId, tab, friendsPage, t])

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

	// link condivisibile con lo username: /u/:username
	async function copyProfileLink() {
		if (!profile) return
		const url = `${window.location.origin}/u/${encodeURIComponent(profile.username)}`
		try {
			await navigator.clipboard.writeText(url)
			toast.success(t('profile.linkCopied'))
		} catch {
			// clipboard non disponibile (es. http): si mostra il link da copiare a mano
			toast.info(url)
		}
	}

	if (profileError && !profile) return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-paprika)]">{profileError}</p>
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
	const privacy = profile.profile_privacy ?? 'public'
	const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
	const memberSince = profile.created_at
		? new Date(profile.created_at).toLocaleDateString(lang, { month: 'long', year: 'numeric' })
		: null

	// riquadro per una sezione nascosta dalla privacy del profilo
	function renderRestricted(restriction: Restriction, kind: Tab) {
		return (
			<div className="mt-4 rounded-2xl border border-dashed border-[var(--wc-border)] p-8 text-center">
				<p aria-hidden="true" className="text-3xl">
					{privacy === 'private' ? '🔒' : '👥'}
				</p>
				<p className="mt-2 font-display text-lg text-[var(--wc-text)]">
					{t(kind === 'recipes' ? 'profile.restricted.recipesTitle' : 'profile.restricted.friendsTitle')}
				</p>
				<p className="mx-auto mt-1 max-w-md text-sm text-[var(--wc-text-muted)]">
					{restriction === 401
						? t('profile.restricted.guest')
						: privacy === 'private'
							? t('profile.restricted.private', { name: profile!.username })
							: t('profile.restricted.friendsOnly', { name: profile!.username })}
				</p>
				{restriction === 401 && (
					<Link
						to="/login"
						state={{ from: location }}
						className="mt-4 inline-block rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
					>
						{t('nav.signIn')}
					</Link>
				)}
			</div>
		)
	}

	const tabClass = (x: Tab) =>
		`rounded-full px-4 py-1.5 text-sm transition-colors ${
			tab === x ? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'
		}`
	const recipeCount = profile.recipes_count ?? recipes?.total

	return (
		<div className="mx-auto max-w-5xl px-4 py-12">
			<div className="flex flex-wrap items-center gap-5">
				<Avatar username={profile.username} url={profile.avatar_url} className="h-20 w-20 text-3xl" />
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="truncate font-display text-3xl text-[var(--wc-text)]">{profile.username}</h1>
						{privacy !== 'public' && (
							<span
								title={t(`profilePrivacy.${privacy}Help`)}
								className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
									privacy === 'private'
										? 'border-[var(--wc-paprika)] text-[var(--wc-paprika)]'
										: 'border-[var(--wc-saffron)] text-[var(--wc-saffron)]'
								}`}
							>
								{privacy === 'private' ? '🔒' : '👥'} {t(`profilePrivacy.${privacy}`)}
							</span>
						)}
					</div>
					{fullName && <p className="text-sm text-[var(--wc-text)]">{fullName}</p>}
					<p className="mt-1 text-sm text-[var(--wc-text-muted)]">
						{recipeCount != null && t('profile.recipesCount', { count: recipeCount })}
						{profile.friends_count != null && ` · ${t('profile.friendsCount', { count: profile.friends_count })}`}
						{profile.total_likes_received != null && ` · ${t('profile.likesReceived', { count: profile.total_likes_received })}`}
					</p>
					{(profile.city || memberSince) && (
						<p className="mt-0.5 text-xs text-[var(--wc-text-muted)]">
							{profile.city && `📍 ${profile.city}`}
							{profile.city && memberSince && ' · '}
							{memberSince && t('profile.memberSince', { date: memberSince })}
						</p>
					)}
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

			{profile.bio && <p className="mt-4 max-w-2xl whitespace-pre-line break-words text-[var(--wc-text)]">{profile.bio}</p>}

			{/* condivisione del profilo + azioni di moderazione (segnala, blocca) */}
			<div className="mt-3 flex flex-wrap items-center gap-4">
				<button
					type="button"
					onClick={() => void copyProfileLink()}
					className="text-xs text-[var(--wc-text-muted)] hover:text-[var(--wc-saffron)] hover:underline"
				>
					🔗 {t('profile.copyLink')}
				</button>
				{!isMe && me && (
					<>
						<ReportButton targetType="user" targetId={profile.id} ownerId={profile.id} />
						<button
							type="button"
							onClick={() => setConfirmBlock(true)}
							className="text-xs text-[var(--wc-text-muted)] hover:text-[var(--wc-paprika)] hover:underline"
						>
							⊘ {t('block.button')}
						</button>
					</>
				)}
			</div>

			<div className="mt-10 flex flex-wrap items-center justify-between gap-3">
				<div className="flex gap-2" role="tablist" aria-label={t('profile.tabsLabel')}>
					<button role="tab" aria-selected={tab === 'recipes'} className={tabClass('recipes')} onClick={() => setTab('recipes')}>
						{t('profile.tabs.recipes')}
						{recipeCount != null && ` (${recipeCount})`}
					</button>
					<button role="tab" aria-selected={tab === 'friends'} className={tabClass('friends')} onClick={() => setTab('friends')}>
						{t('profile.tabs.friends')}
						{profile.friends_count != null && ` (${profile.friends_count})`}
					</button>
				</div>
				{tab === 'recipes' && recipes && recipes.items.length > 0 && (
					<RecipeSortSelect
						value={sort}
						onChange={(v) => {
							setSort(v)
							setPage(1)
						}}
					/>
				)}
			</div>

			{tab === 'recipes' &&
				(recipesRestricted ? (
					renderRestricted(recipesRestricted, 'recipes')
				) : recipesError ? (
					<p className="mt-4 text-[var(--wc-paprika)]">{recipesError}</p>
				) : !recipes ? (
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
				))}

			{tab === 'friends' &&
				(friendsRestricted ? (
					renderRestricted(friendsRestricted, 'friends')
				) : friendsError ? (
					<p className="mt-4 text-[var(--wc-paprika)]">{friendsError}</p>
				) : !friends ? (
					<div className="mt-4">
						<ListSkeleton rows={3} />
					</div>
				) : friends.items.length === 0 ? (
					<p className="mt-4 text-[var(--wc-text-muted)]">{t('profile.noFriends')}</p>
				) : (
					<>
						<ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{friends.items.map((f) => (
								<li key={f.id}>
									<Link
										to={`/u/${encodeURIComponent(f.username)}`}
										className="flex items-center gap-3 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-3 transition-colors hover:border-[var(--wc-basil)]"
									>
										<Avatar username={f.username} url={f.avatar_url} className="h-10 w-10 text-base" />
										<span className="min-w-0">
											<span className="block truncate font-medium text-[var(--wc-text)]">{f.username}</span>
											<span className="block text-xs text-[var(--wc-text-muted)]">
												{t('profile.friendsSince', {
													date: new Date(f.friends_since).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }),
												})}
											</span>
										</span>
									</Link>
								</li>
							))}
						</ul>
						<Pagination page={friends.page} totalPages={friends.total_pages} onChange={setFriendsPage} />
					</>
				))}

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
