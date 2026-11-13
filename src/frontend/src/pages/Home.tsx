import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import KitchenScene from '../3d/components/KitchenScene'

import { api, qs, toPage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../lib/useLang'
import RecipeCard from '../components/RecipeCard'
import { RecipeGridSkeleton } from '../components/Skeleton'
import type { FriendItem, Paginated, RecipeSummary } from '../types/models'

const FEED_SIZE = 8

type FeedTab = 'friends' | 'community'
const TABS: FeedTab[] = ['friends', 'community']

// Home page with two feeds:
//   Community → GET /recipes   (recent public recipes)
//   Friends   → GET /feed      (recipes from confirmed friends, sign-in required)
// Default tab: "Friends" when signed in with at least one friend, otherwise "Community".
function Home() {
	const { t } = useTranslation()
	const lang = useLang()
	const { user, isLoading: authLoading } = useAuth()
	const navigate = useNavigate()
	// null = no explicit choice yet: use the default tab
	const [chosenTab, setChosenTab] = useState<FeedTab | null>(null)
	// GET /friends result tied to the user who requested it (avoids synchronous setState in the effect)
	const [friendsInfo, setFriendsInfo] = useState<{ userId: number; hasFriends: boolean } | null>(null)
	const [result, setResult] = useState<{ key: string; recipes: RecipeSummary[]; error: string | null } | null>(null)

	// The default tab only needs to know whether at least one friend exists
	const userId = user?.id
	useEffect(() => {
		if (authLoading || userId == null) return
		let cancelled = false
		api
			.get<unknown>(`/friends${qs({ page: 1, limit: 1 })}`)
			.then((d) => {
				if (!cancelled) setFriendsInfo({ userId, hasFriends: toPage<FriendItem>(d).total > 0 })
			})
			.catch(() => {
				if (!cancelled) setFriendsInfo({ userId, hasFriends: false })
			})
		return () => {
			cancelled = true
		}
	}, [authLoading, userId])

	// null = unknown yet (session or friend list still loading)
	const hasFriends: boolean | null = authLoading
		? null
		: userId == null
			? false
			: friendsInfo?.userId === userId
				? friendsInfo.hasFriends
				: null
	const defaultTab: FeedTab | null = hasFriends === null ? null : hasFriends ? 'friends' : 'community'
	const tab = chosenTab ?? defaultTab
	// The friends feed requires sign-in: guests don't call the backend
	const needsFetch = tab === 'community' || (tab === 'friends' && userId != null)
	const requestKey = `${tab}|${lang}|${userId ?? ''}`

	useEffect(() => {
		if (!tab || !needsFetch) return
		let cancelled = false
		const path = tab === 'friends' ? '/feed' : '/recipes'
		api
			.get<Paginated<RecipeSummary>>(`${path}${qs({ page: 1, limit: FEED_SIZE, lang })}`)
			.then((data) => {
				if (!cancelled) setResult({ key: requestKey, recipes: data?.items ?? [], error: null })
			})
			.catch(() => {
				if (!cancelled) setResult({ key: requestKey, recipes: [], error: t('home.loadError') })
			})
		return () => {
			cancelled = true
		}
	}, [tab, needsFetch, lang, requestKey, t])

	// "Add recipe": signed-in users go to the form, guests go to sign-in first
	// (Login reads state.from and navigates there after a successful sign-in).
	function addRecipe() {
		const target = '/my-recipes/new'
		if (user) navigate(target)
		else navigate('/login', { state: { from: { pathname: target } } })
	}

	const current = result?.key === requestKey ? result : null
	const loading = tab === null || (needsFetch && current === null)
	const recipes = current?.recipes ?? []
	const error = current?.error ?? null
	const showFriendsEmpty = tab === 'friends' && !loading && !error && recipes.length === 0

	return (
		<div>
			<section className="relative h-[70vh] w-full overflow-hidden">
				<KitchenScene />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--wc-bg)] to-transparent p-8">
					<h1 className="font-display text-4xl text-[var(--wc-text)] md:text-5xl">{t('home.heroTitle')}</h1>
					<p className="mt-2 max-w-md text-[var(--wc-text-muted)]">{t('home.heroText')}</p>
					{/* The container has pointer-events-none (for the 3D scene): the button re-enables them */}
					<button
						type="button"
						onClick={addRecipe}
						disabled={authLoading}
						className="pointer-events-auto mt-5 rounded-full bg-[var(--wc-basil)] px-6 py-2.5 font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
					>
						+ {t('home.addRecipe')}
					</button>
				</div>
			</section>

			<section className="mx-auto max-w-7xl px-4 py-12">
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
					<div className="flex gap-2" role="tablist" aria-label={t('home.feedTabs')}>
						{TABS.map((x) => (
							<button
								key={x}
								role="tab"
								id={`home-tab-${x}`}
								aria-selected={tab === x}
								aria-controls="home-feed"
								onClick={() => setChosenTab(x)}
								className={`rounded-full px-4 py-1.5 font-display text-lg transition-colors ${
									tab === x
										? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]'
										: 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'
								}`}
							>
								{t(`home.tabs.${x}`)}
							</button>
						))}
					</div>
					<Link to="/search" className="text-sm text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]">
						{t('home.seeAll')}
					</Link>
				</div>

				<div id="home-feed" role="tabpanel" aria-labelledby={tab ? `home-tab-${tab}` : undefined}>
					{error && <p className="text-[var(--wc-paprika)]">{error}</p>}

					{loading ? (
						<RecipeGridSkeleton count={FEED_SIZE} />
					) : showFriendsEmpty ? (
						<div className="rounded-2xl border border-dashed border-[var(--wc-border)] p-8 text-center">
							<p className="font-display text-xl text-[var(--wc-text)]">
								{userId == null ? t('home.friendsEmpty.guestTitle') : t('home.friendsEmpty.title')}
							</p>
							<p className="mx-auto mt-2 max-w-md text-sm text-[var(--wc-text-muted)]">
								{userId == null ? t('home.friendsEmpty.guestText') : t('home.friendsEmpty.text')}
							</p>
							<div className="mt-5 flex flex-wrap justify-center gap-3">
								<button
									type="button"
									onClick={() => setChosenTab('community')}
									className="rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
								>
									{t('home.friendsEmpty.explore')}
								</button>
								{userId == null ? (
									<Link
										to="/login"
										className="rounded-full border border-[var(--wc-border)] px-5 py-2 text-sm hover:border-[var(--wc-basil)]"
									>
										{t('nav.signIn')}
									</Link>
								) : (
									<Link
										to="/friends"
										className="rounded-full border border-[var(--wc-border)] px-5 py-2 text-sm hover:border-[var(--wc-basil)]"
									>
										{t('home.friendsEmpty.connect')}
									</Link>
								)}
							</div>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{recipes.map((r) => (
								<RecipeCard key={r.id} recipe={r} />
							))}
							{!error && recipes.length === 0 && <p className="text-[var(--wc-text-muted)]">{t('home.empty')}</p>}
						</div>
					)}
				</div>
			</section>
		</div>
	)
}

export default Home
