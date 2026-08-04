import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Texture } from 'three'
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

	useFrame(() => {
		if (matRef.current) {
			matRef.current.uProgress = progressRef?.current ?? progress ?? 0
		}
	})

	return (
		<mesh position={position}>
			<planeGeometry args={[width, height, 64, 2]} />
			{/* @ts-expect-error - ignores the following error */}
			<pageCurlMaterial
				ref={matRef}
				uMapFront={frontMap}
				uMapBack={backMap}
				uPageHeight={height}
				uHingeOffset={0.025}
				side={DoubleSide}
				/>
		</mesh>
	)
}