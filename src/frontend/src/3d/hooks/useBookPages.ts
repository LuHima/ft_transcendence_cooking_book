import { useFrame } from "@react-three/fiber"
import { useRef } from "react"

export function useBookPages(numPages: number) {
	// un ref di progress per pagina, così non ri-renderizzi ad ogni frame
	const pageProgress = useRef(Array.from({ length: numPages }, () => 0))
	const currentPage = useRef(0) // indice della pagina "attiva" in transizione
	const turning = useRef(false)
	const direction = useRef(1) // 1 = avanti, -1 = indietro

	useFrame((_, delta) => {
		if (!turning.current) return;
		const speed = 0.4
		const i = currentPage.current
		pageProgress.current[i] = Math.max(
			0,
			Math.min(1, pageProgress.current[i] + direction.current * (delta / speed))
		)

		if (direction.current === 1 && pageProgress.current[i] >= 1) {
			turning.current = false
			currentPage.current += 1
		}
		if (direction.current === -1 && pageProgress.current[i] <= 0) {
			turning.current = false
		}
	})

	function nextPage() {
		if (turning.current || currentPage.current >= numPages) return
		direction.current = 1
		turning.current = true
	}

	function prevPage() {
		if (turning.current || currentPage.current <= 0) return
		currentPage.current -= 1
		direction.current = -1
		turning.current = true
	}

	return { pageProgress, currentPage, nextPage, prevPage, turning }
}