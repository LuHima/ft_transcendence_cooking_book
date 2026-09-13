import { useRef, type RefObject, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Texture } from 'three'
import * as THREE from 'three'
import './materials/PageCurlMaterial' // side-effect: registra extend()

interface PageProps {
	progressRef?: RefObject<number>
	progress?: number
	frontMap: Texture
	backMap: Texture
	width: number
	height: number
	position: [number, number, number]
}

export function Page({ progressRef, progress, frontMap, backMap, width, height, position }: PageProps) {
	const matRef = useRef<any>(null)

	function easeInOutCubic(t: number) {
	return t < 0.5
		? 4 * t * t * t
		: 1 - Math.pow(-2 * t + 2, 3) / 2
	}

	useFrame(() => {
		if (matRef.current) {
			const rawProgress = progressRef?.current ?? progress ?? 0
			matRef.current.uProgress = easeInOutCubic(rawProgress + 0.1) // aggiungi un piccolo offset per evitare problemi di precisione
		}
	})

	return (
		<mesh position={position}>
			<planeGeometry args={[width - 0.02, height, 32, 32]} />
			{/* @ts-expect-error - ignores the following error */}
			<pageCurlMaterial
				ref={matRef}
				uMapFront={frontMap}
				uMapBack={backMap}
				uPageHeight={height}
				uPageWidth={width - 0.02}
				uHingeOffset={0.025}
				side={DoubleSide}
				/>
		</mesh>
	)
}