import type { Lang } from '../types/models'

// bandierine in SVG (le emoji bandiera non si vedono su Windows): IT, FR e UK per l'inglese
function Flag({ lang, className = 'h-4 w-6' }: { lang: Lang; className?: string }) {
	const common = { viewBox: '0 0 30 20', className: `${className} shrink-0 rounded-[2px] ring-1 ring-black/20`, 'aria-hidden': true as const }
	if (lang === 'it')
		return (
			<svg {...common}>
				<rect width="10" height="20" fill="#009246" />
				<rect x="10" width="10" height="20" fill="#fff" />
				<rect x="20" width="10" height="20" fill="#ce2b37" />
			</svg>
		)
	if (lang === 'fr')
		return (
			<svg {...common}>
				<rect width="10" height="20" fill="#0055a4" />
				<rect x="10" width="10" height="20" fill="#fff" />
				<rect x="20" width="10" height="20" fill="#ef4135" />
			</svg>
		)
	return (
		<svg {...common}>
			<rect width="30" height="20" fill="#012169" />
			<path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
			<path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth="1.6" />
			<path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6" />
			<path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3.4" />
		</svg>
	)
}

export default Flag
