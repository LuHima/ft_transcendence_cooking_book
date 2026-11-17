import { useFrame } from "@react-three/fiber"
import { useEffect, useRef } from "react"

export function useBookPages(
	numPages: number,
	pageSetKey: number,
	onPageChange?: (page: number) => void,
) {
	// un ref di progress per pagina, così non ri-renderizzi ad ogni frame
	const pageProgress = useRef(Array.from({ length: numPages }, () => 0))
	const currentPage = useRef(0) // indice della pagina "attiva" in transizione
	const turning = useRef(false)
	const direction = useRef(1) // 1 = avanti, -1 = indietro
	const closing = useRef(false)
	const onPageChangeRef = useRef(onPageChange)

	useEffect(() => {
		onPageChangeRef.current = onPageChange
	}, [onPageChange])

	useEffect(() => {
		pageProgress.current = Array.from({ length: numPages }, () => 0)
		currentPage.current = 0
		turning.current = false
		closing.current = false
	}, [numPages, pageSetKey])

	

	function closePages() {
		closing.current = true
		turning.current = false
	}

	useFrame((_, delta) => {
		const speed = 1

		if (closing.current) {
			let done = true
			pageProgress.current = pageProgress.current.map((p) => {
				const next = Math.max(0, p - delta / speed)
				if (next > 0) done = false
				return next
			})

			if (done) {
				closing.current = false
				if (currentPage.current !== 0) {
					currentPage.current = 0
					onPageChangeRef.current?.(0)
				}
			}
		}

		if (!turning.current) return
		const i =
			direction.current === 1
				? currentPage.current
				: currentPage.current - 1
		pageProgress.current[i] = Math.max(
			0,
			Math.min(1, pageProgress.current[i] + direction.current * (delta / speed))
		)

		if (direction.current === 1 && pageProgress.current[i] >= 1) {
			turning.current = false
			currentPage.current += 1
			onPageChangeRef.current?.(currentPage.current)
		}
		if (direction.current === -1 && pageProgress.current[i] <= 0) {
			turning.current = false
			currentPage.current -= 1
			onPageChangeRef.current?.(currentPage.current)
		}
	})

	function nextPage() {
		if (closing.current || turning.current || currentPage.current >= numPages) return
		direction.current = 1
		turning.current = true
	}

	function prevPage() {
		if (closing.current || turning.current || currentPage.current <= 0) return
		direction.current = -1
		turning.current = true
	}

	return { pageProgress, currentPage, nextPage, prevPage, turning, closePages }
}