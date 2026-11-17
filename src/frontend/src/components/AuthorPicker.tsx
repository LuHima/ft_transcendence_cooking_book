import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api, qs, toPage } from '../api/client'
import { useAuth } from '../context/auth'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import type { PublicUser, UserSearchResult } from '../types/models'

// GET /users?search= rejects (400) searches shorter than 2 characters
const MIN_CHARS = 2
const MAX_OPTIONS = 8

interface AuthorOption {
	id: number
	username: string
	isMe?: boolean
}

interface AuthorPickerProps {
	// Selected author (URL ?author=<id>), null when no author filter is active
	authorId: number | null
	onChange: (id: number | null) => void
}

// Author filter of the search page: debounced username search (GET /users?search=) that stores the user ID,
// shown as a clearable @username chip. Shared URLs (?author=<id>) are hydrated with GET /users/:id.
function AuthorPicker({ authorId, onChange }: AuthorPickerProps) {
	const { t } = useTranslation()
	const { user: me } = useAuth()
	const listId = useId()
	const inputId = useId()
	const [text, setText] = useState('')
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)
	// Usernames already known (picked from the list or hydrated), by user ID
	const [known, setKnown] = useState<ReadonlyMap<number, string>>(() => new Map())
	const [hydrateFailed, setHydrateFailed] = useState<number | null>(null)

	const selectedName = authorId == null ? null : authorId === me?.id ? me.username : (known.get(authorId) ?? null)

	// Shared URL with ?author=<id>: fetch the username once
	useEffect(() => {
		if (authorId == null || selectedName != null) return
		const controller = new AbortController()
		api
			.get<PublicUser>(`/users/${authorId}`, { signal: controller.signal })
			.then((u) => {
				if (controller.signal.aborted || !u?.username) return
				setKnown((prev) => new Map(prev).set(authorId, u.username))
			})
			.catch(() => {
				if (!controller.signal.aborted) setHydrateFailed(authorId)
			})
		return () => controller.abort()
	}, [authorId, selectedName])

	const query = useDebouncedValue(text.trim(), 300)
	const [result, setResult] = useState<{ query: string; items: AuthorOption[]; error: boolean } | null>(null)

	useEffect(() => {
		if (!open || query.length < MIN_CHARS) return
		const controller = new AbortController()
		api
			.get<unknown>(`/users${qs({ search: query, page: 1, limit: MAX_OPTIONS, sort_by: 'username', sort_order: 'asc' })}`, {
				signal: controller.signal,
			})
			.then((d) => {
				if (controller.signal.aborted) return
				const items = toPage<UserSearchResult>(d, MAX_OPTIONS).items.map((u) => ({ id: u.id, username: u.username }))
				setResult({ query, items, error: false })
			})
			.catch(() => {
				if (!controller.signal.aborted) setResult({ query, items: [], error: true })
			})
		return () => controller.abort()
	}, [open, query])

	const trimmed = text.trim()
	const tooShort = trimmed.length < MIN_CHARS
	const current = result?.query === query && trimmed === query ? result : null
	const loading = !tooShort && current === null

	// GET /users excludes the caller: match the signed-in user locally
	const options = useMemo<AuthorOption[]>(() => {
		if (tooShort) return []
		const list = current?.items ?? []
		const q = trimmed.toLowerCase()
		if (me && me.username.toLowerCase().includes(q) && !list.some((u) => u.id === me.id)) {
			return [{ id: me.id, username: me.username, isMe: true }, ...list].slice(0, MAX_OPTIONS)
		}
		return list
	}, [current, tooShort, trimmed, me])

	function choose(o: AuthorOption) {
		setKnown((prev) => new Map(prev).set(o.id, o.username))
		setText('')
		setOpen(false)
		setActiveIndex(0)
		onChange(o.id)
	}

	function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setOpen(true)
			setActiveIndex((i) => Math.min(i + 1, Math.max(options.length - 1, 0)))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => Math.max(i - 1, 0))
		} else if (e.key === 'Enter') {
			if (open && options[activeIndex]) {
				e.preventDefault()
				choose(options[activeIndex])
			}
		} else if (e.key === 'Escape') {
			setOpen(false)
		}
	}

	if (authorId != null) {
		const label = selectedName ? `@${selectedName}` : hydrateFailed === authorId ? `#${authorId}` : t('common.loading')
		return (
			<div className="text-xs text-[var(--wc-text-muted)]">
				<span id={inputId}>{t('search.author')}</span>
				<div className="mt-1">
					<button
						type="button"
						onClick={() => onChange(null)}
						aria-describedby={inputId}
						aria-label={t('search.clearAuthor', { name: selectedName ?? `#${authorId}` })}
						className="inline-flex items-center gap-1 rounded-full border border-[var(--wc-basil)] bg-[var(--wc-basil)] px-3 py-1.5 text-sm text-[var(--wc-bg)]"
					>
						{label} <span aria-hidden="true">×</span>
					</button>
				</div>
			</div>
		)
	}

	const status = tooShort
		? trimmed
			? t('search.userMinChars', { count: MIN_CHARS })
			: null
		: loading && options.length === 0
			? t('common.loading')
			: current?.error && options.length === 0
				? t('search.authorError')
				: options.length === 0
					? t('search.noAuthors')
					: null

	return (
		<div className="text-xs text-[var(--wc-text-muted)]">
			<label htmlFor={inputId}>{t('search.author')}</label>
			<div className="relative mt-1">
				<input
					id={inputId}
					value={text}
					role="combobox"
					aria-expanded={open && (options.length > 0 || status !== null)}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={open && options[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined}
					aria-busy={loading}
					autoComplete="off"
					placeholder={t('search.authorPlaceholder')}
					onChange={(e) => {
						setText(e.target.value)
						setOpen(true)
						setActiveIndex(0)
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setOpen(false)}
					onKeyDown={handleKeyDown}
					className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]"
				/>
				{open && (options.length > 0 || status) && (
					<ul
						id={listId}
						role="listbox"
						className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-lg"
					>
						{options.map((o, index) => (
							<li
								key={o.id}
								id={`${listId}-opt-${index}`}
								role="option"
								aria-selected={index === activeIndex}
								tabIndex={-1}
								onMouseDown={(e) => {
									e.preventDefault()
									choose(o)
								}}
								onMouseEnter={() => setActiveIndex(index)}
								className={`flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-sm text-[var(--wc-text)] ${
									index === activeIndex ? 'bg-[var(--wc-surface-raised)]' : ''
								}`}
							>
								<span className="truncate">@{o.username}</span>
								{o.isMe && <span className="shrink-0 text-[10px] uppercase text-[var(--wc-text-muted)]">{t('search.you')}</span>}
							</li>
						))}
						{status && (
							<li role="status" className={`px-3 py-2 text-sm ${current?.error ? 'text-[var(--wc-paprika)]' : 'text-[var(--wc-text-muted)]'}`}>
								{status}
							</li>
						)}
					</ul>
				)}
			</div>
		</div>
	)
}

export default AuthorPicker
