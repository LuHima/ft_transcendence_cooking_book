import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

interface SearchBarProps {
	className?: string
	placeholder?: string
}

function SearchBar({ className = '', placeholder = 'Cerca una ricetta…' }: SearchBarProps) {
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const [value, setValue] = useState(searchParams.get('q') ?? '')

	function handleSubmit(e: FormEvent) {
		e.preventDefault()
		const trimmed = value.trim()
		if (!trimmed) return
		navigate(`/search?q=${encodeURIComponent(trimmed)}`)
	}

	return (
		<form onSubmit={handleSubmit} className={`flex items-center ${className}`} role="search">
			<input
				type="search"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder={placeholder}
				aria-label="Cerca ricette"
				className="w-full rounded-l-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4 py-2 text-sm text-[var(--wc-text)] placeholder:text-[var(--wc-text-muted)] outline-none focus:border-[var(--wc-basil)]"
			/>
			<button
				type="submit"
				className="rounded-r-full border border-l-0 border-[var(--wc-border)] bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)]"
			>
				Cerca
			</button>
		</form>
	)
}

export default SearchBar
