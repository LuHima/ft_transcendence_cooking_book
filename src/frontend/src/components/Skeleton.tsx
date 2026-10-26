// segnaposto animati mostrati durante i caricamenti
export function Skeleton({ className = '' }: { className?: string }) {
	return <div aria-hidden="true" className={`animate-pulse rounded-md bg-[var(--wc-surface-raised)] ${className}`} />
}

export function RecipeCardSkeleton() {
	return (
		<div className="overflow-hidden rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)]">
			<Skeleton className="aspect-[4/3] w-full rounded-none" />
			<div className="space-y-3 p-4">
				<Skeleton className="h-5 w-3/4" />
				<Skeleton className="h-3 w-full" />
				<Skeleton className="h-3 w-2/3" />
				<div className="flex gap-2 pt-2">
					<Skeleton className="h-5 w-16 rounded-full" />
					<Skeleton className="h-5 w-12 rounded-full" />
				</div>
			</div>
		</div>
	)
}

export function RecipeGridSkeleton({ count = 6 }: { count?: number }) {
	return (
		<div role="status" aria-busy="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: count }, (_, i) => (
				<RecipeCardSkeleton key={i} />
			))}
		</div>
	)
}

export function RecipeDetailSkeleton() {
	return (
		<div role="status" aria-busy="true" className="mx-auto max-w-3xl px-4 py-12">
			<Skeleton className="aspect-[16/9] w-full rounded-2xl" />
			<Skeleton className="mt-6 h-10 w-2/3" />
			<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
				{Array.from({ length: 4 }, (_, i) => (
					<Skeleton key={i} className="h-16 rounded-xl" />
				))}
			</div>
			<Skeleton className="mt-6 h-4 w-full" />
			<Skeleton className="mt-2 h-4 w-5/6" />
			<Skeleton className="mt-8 h-6 w-32" />
			<div className="mt-3 space-y-2">
				{Array.from({ length: 5 }, (_, i) => (
					<Skeleton key={i} className="h-4 w-1/2" />
				))}
			</div>
		</div>
	)
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
	return (
		<div role="status" aria-busy="true" className="divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)]">
			{Array.from({ length: rows }, (_, i) => (
				<div key={i} className="flex items-center justify-between gap-4 p-4">
					<div className="space-y-2">
						<Skeleton className="h-5 w-48" />
						<Skeleton className="h-3 w-28" />
					</div>
					<Skeleton className="h-8 w-28 rounded-full" />
				</div>
			))}
		</div>
	)
}
