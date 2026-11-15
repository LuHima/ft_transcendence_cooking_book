import { useEffect, useRef, type RefObject } from 'react'

// Scrolls the element into view whenever `value` changes (not on mount): used by paginated
// lists so that changing page brings the user back to the top of the list
export function useScrollIntoViewOnChange(value: unknown, ref: RefObject<HTMLElement | null>) {
	const first = useRef(true)
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
	}, [value, ref])
}
