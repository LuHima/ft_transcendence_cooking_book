import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows, Text, useTexture } from '@react-three/drei'
import { Object3D, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'

// FROM ASSETS

import kitchenUrl from '../assets/kitchen3.0.glb?url'
import leatherColorUrl from '../assets/fabric_leather_02_diff_4k.jpg?url'
import leatherRoughnessUrl from '../assets/fabric_leather_02_rough_4k.jpg?url'
import leatherDispUrl from '../assets/fabric_leather_02_disp_4k.png?url'
import leatherNormalUrl from '../assets/fabric_leather_02_nor_gl_4k.jpg'

import leatherColorUrl1 from '../assets/brown_leather_albedo_4k.jpg'
import leatherRoughnessUrl1 from '../assets/brown_leather_rough_4k.jpg?url'
import leatherDispUrl1 from '../assets/brown_leather_disp_4k.png?url'
import leatherNormalUrl1 from '../assets/brown_leather_nor_gl_4k.jpg'

import logoUrl from '../assets/biggernobg.png'
// END ASSETS

function useLogoTexture() {
	const logoMap = useTexture(logoUrl)
	logoMap.colorSpace = SRGBColorSpace
	return logoMap
}

function useLeatherMaterial() {
	const [colorMap, roughnessMap, normalMap, dispMap] = useTexture([
		leatherColorUrl,
		leatherRoughnessUrl,
		leatherNormalUrl,
		leatherDispUrl,
	]);

	colorMap.colorSpace = SRGBColorSpace;

	[colorMap, roughnessMap, normalMap, dispMap].forEach((tex) => {
		tex.wrapS = tex.wrapT = RepeatWrapping
		tex.repeat.set(1, 1)
	})

	return { colorMap, roughnessMap, normalMap, dispMap }
}

function useLeatherMaterial1() {
	const [colorMap1, roughnessMap1, normalMap1, dispMap1] = useTexture([
		leatherColorUrl1,
		leatherRoughnessUrl1,
		leatherNormalUrl1,
		leatherDispUrl1,
	]);

	colorMap1.colorSpace = SRGBColorSpace;

	[colorMap1, roughnessMap1, normalMap1, dispMap1].forEach((tex) => {
		tex.wrapS = tex.wrapT = RepeatWrapping
		tex.repeat.set(1, 1)
	})

	return { colorMap1, roughnessMap1, normalMap1, dispMap1 }
}

interface BookProps {
	controlsRef: React.RefObject<any>
}

// esempio
const recipes = [
  { id: 1, title: "Pasta al Pomodoro" },
  { id: 2, title: "Risotto ai Funghi" },
  { id: 3, title: "Tiramisù" },
]

function Book({controlsRef} : BookProps) {
	
	const originalLimits = useRef({
		minPolarAngle: Math.PI * 0.35,
		maxPolarAngle: Math.PI * 0.55,
		minAzimuthAngle: -Math.PI * 0.8,
		maxAzimuthAngle: -Math.PI * 0.20,
		minDistance: 0.5,
		maxDistance: 2.5,
	})

	function setControlsLimits(limits: Partial<typeof originalLimits.current>) {
		const c = controlsRef.current
		if (!c) return
		Object.assign(c, limits)
		c.update()
	}
	
	const { colorMap, normalMap, roughnessMap } = useLeatherMaterial()
	const { colorMap1, normalMap1, roughnessMap1 } = useLeatherMaterial1()

	const [isOpen, setIsOpen] = useState(false)
	const coverBottomRef = useRef<any>(null)
	const coverTopRef = useRef<any>(null)
	const hingeRef = useRef<any>(null)
	const [hovered, setHovered] = useState(false)

	const progress = useRef(0)

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !isOpen || camPhase.current !== 'idle') return
			event.preventDefault()
			setIsOpen(false)
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isOpen])

	const { camera } = useThree()
	const camPhase = useRef<'idle' | 'zooming-in' | 'zooming-out'>('idle')
	const camProgress = useRef(0)

	const initialCamPos = useRef(new Vector3(-10, 1.5, 0))
	const initialTarget = useRef(new Vector3(-3, 1.5, 0))

	// da tarare
	const zoomedCamPos = useRef(new Vector3(-2.51, 1.3, -0.1))
	const zoomedTarget = useRef(new Vector3(-2.5, 1, -0.1))

	useFrame((_, delta) => {
		const camSpeed = 1

		if (camPhase.current === 'zooming-in' || camPhase.current === 'zooming-out') {
			const dir = camPhase.current ==='zooming-in' ? 1 : -1
			camProgress.current = Math.max(0, Math.min(1, camProgress.current + dir * (delta / camSpeed)))
			const t = 1 - Math.pow(1 - camProgress.current, 3);

			camera.position.lerpVectors(initialCamPos.current, zoomedCamPos.current, t)
			if (controlsRef.current) {
				controlsRef.current.target.lerpVectors(initialTarget.current, zoomedTarget.current, t)
				controlsRef.current.update()
			}

			if (camPhase.current === 'zooming-in' && camProgress.current >= 1){
				camPhase.current = 'idle'
				setIsOpen(true)
			}

			if (camPhase.current === 'zooming-out' && camProgress.current <= 0) {
				camPhase.current = 'idle'
				if (controlsRef.current) controlsRef.current.enabled = true
					setControlsLimits(originalLimits.current)
			}
		}

		const targetProgress = isOpen ? 1 : 0
		const speed = 1
		const direction = targetProgress === 1 ? 1 : -1
		const wasOpen = progress.current > 0

		progress.current += direction * (delta / speed)
		progress.current = Math.max(0, Math.min(1, progress.current))

		if (wasOpen && progress.current === 0 && camPhase.current == 'idle')
			camPhase.current = 'zooming-out'

		const eased = 1 - Math.pow(1 - progress.current, 3)
		const angle = eased * -Math.PI

		if (coverTopRef.current) {
			if (coverTopRef.current)
			{
				coverTopRef.current.rotation.x = angle
				coverTopRef.current.position.y = 0.155
				const extraSink = 0.02
				coverTopRef.current.position.z = 0.055 - (eased * 0.03) - (eased * extraSink)
			}
		}
		if (hingeRef.current) {
			hingeRef.current.visible = progress.current < 0.225
		}
	})

	const logoMap = useLogoTexture() 
	
	return (
		<group
			position={[-2.5, 1.05, 0]}
			rotation={[-Math.PI / 2, 0, 0]}
			onClick={(e) => {
				e.stopPropagation()
				if (camPhase.current !== 'idle' || isOpen) return
				if (controlsRef.current) controlsRef.current.enabled = false
				setControlsLimits({
					minPolarAngle: 0,
					maxPolarAngle: Math.PI * 0.55,
					minAzimuthAngle: -Infinity,
					maxAzimuthAngle: Infinity,
					maxDistance: 1,
					minDistance: 1,
				})
				camPhase.current = 'zooming-in'
			}}
			onPointerDown={(e) => {
				e.stopPropagation()
				if (isOpen || !controlsRef.current || camPhase.current !== 'idle') return
				controlsRef.current.enabled = false
			}}
			onPointerUp={() => {
				if (isOpen || !controlsRef.current || camPhase.current !== 'idle') return
				controlsRef.current.enabled = true
			}}
			>

			<mesh
				position={[0, 0, 0.03]}
				renderOrder={998}
				onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
				onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
			>
				<boxGeometry args={[0.48, 0.42, 0.08]} />
				<meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
			</mesh>

			{/* copertina bassa (fissa) */}
			<group ref={coverBottomRef} position={[0, 0.005, 0.005]} rotation={[0, 0, 0]}>
				<mesh position={[0, 0, 0]} castShadow receiveShadow>
					<boxGeometry args={[0.4, 0.3, 0.02]} />
					<meshStandardMaterial
						map={colorMap}
						normalMap={normalMap}
						roughnessMap={roughnessMap}
						normalScale={[0.6, 0.6]}
						metalness={0.3}
						roughness={1}
					/>
				</mesh>
				{/* outline for hover */}
				<mesh visible={(!isOpen && hovered) && progress.current <= 0.001} position={[0, 0, 0]} renderOrder={999} scale={[1.002, 1.002, 1.002]}>
					<boxGeometry args={[0.4, 0.3, 0.02]} />
					<meshBasicMaterial color="#ffffff" transparent opacity={0.18} depthWrite={false} toneMapped={false} />
				</mesh>
			</group>

			{/* copertina alta (ruota verso l'alto) */}
			<group ref={coverTopRef} position={[0, 0.155, 0.055]} rotation={[0, 0, 0]}>
				{/* cerniera - sparisce quando il libro è completamente aperto */}
				<mesh ref={hingeRef} position={[0, 0, -0.025]} rotation={[0, 0, -Math.PI * 1.5]} castShadow receiveShadow>
					<cylinderGeometry args={[0.035, 0.035, 0.4, 16, 1, false, 0, Math.PI]} />
					<meshStandardMaterial
						map={colorMap1}
						normalMap={normalMap1}
						roughnessMap={roughnessMap1}
						normalScale={[0.6, 0.6]}
						metalness={0}
						roughness={1}
					/>
				</mesh>

				<mesh visible={(!isOpen && hovered) && progress.current <= 0.001} position={[0, 0, -0.025]} rotation={[0, 0, -Math.PI * 1.5]} renderOrder={999} scale={[1.004, 1.004, 1.004]}>
					<cylinderGeometry args={[0.035, 0.035, 0.4, 16, 1, false, 0, Math.PI]} />
					<meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
				</mesh>

				<mesh position={[0, -0.15, 0]} castShadow receiveShadow>
					<boxGeometry args={[0.4, 0.3, 0.02]} />
					<meshStandardMaterial
						map={colorMap}
						normalMap={normalMap}
						roughnessMap={roughnessMap}
						normalScale={[0.6, 0.6]}
						metalness={0.3}
						roughness={1}
					/>
				</mesh>
				{/* outline for hover - follows the coverTop transforms */}
				<mesh visible={(!isOpen && hovered) && progress.current <= 0.001} position={[0, -0.15, 0]} renderOrder={999} scale={[1.002, 1.002, 1.002]}> 
					<boxGeometry args={[0.4, 0.3, 0.02]} />
					<meshBasicMaterial color="#ffffff" transparent opacity={0.18} depthWrite={false} toneMapped={false} />
				</mesh>

				<mesh
					position={[0.01, -0.1455, 0.011]}
					rotation={[0, 0, -Math.PI / 2]}
				>
					<planeGeometry args={[0.35, 0.2]} />
					<meshStandardMaterial map={logoMap} transparent metalness={0.1} toneMapped={true} alphaTest={0.5} />
				</mesh>
			</group>

			{recipes.map((recipe, index) => {
				const zOffset = 0.01 + index * (0.025 / recipes.length)
				return (
					<group key={recipe.id} position={[0, 0.155, zOffset]}>
						<mesh position={[0, -0.15, 0]} castShadow receiveShadow>
							<boxGeometry args={[0.39, 0.28, 0.002]} />
							<meshStandardMaterial color="#f5e6c8" />
						</mesh>
						<Text position={[0, -0.14, 0.002]} rotation={[0, 0, -Math.PI / 2]} fontSize={0.03} color="#3d1f10" anchorX="center" anchorY="middle">
							{recipe.title}
						</Text>
					</group>
				)
			})}
		</group>
	)
}

function KitchenModel({ scene }: { scene: Object3D }) {
	useMemo(() => {
		scene.traverse((c: any) => {
			if (c.isMesh) {
				c.castShadow = true
				c.receiveShadow = true
			}
		})
	}, [scene])
	return <primitive object={scene} dispose={null} />
}

function LoadingFallback() {
	return (
		<mesh>
			<boxGeometry args={[1, 1, 1]} />
			<meshBasicMaterial color="white" wireframe />
		</mesh>
	)
}

export default function Scene() {
	const { scene } = useGLTF(kitchenUrl)
	const controlsRef = useRef<any>(null)

	return (
		<Canvas shadows="percentage" dpr={[1, 2]} camera={{ position: [-10, 1.5, 0], fov: 45 }}>
			<ambientLight intensity={1.1} color="#fff5e0" />

			<directionalLight
			position={[-9, 4, 1]}
			intensity={1.3}
			color="#ffd9a8"
			target-position={[-2.5, 1.05, 0]}
			castShadow={false}
			/>

			<directionalLight position={[-5, 3, 4]} intensity={1} color="#ffffff" />
			<directionalLight position={[-5, 3, -4]} intensity={1} color="#ffe8cc" />

			<pointLight position={[-2.5, 2.5, 0]} intensity={1} color="#ffe4b0" distance={4} decay={2} />

			<Suspense fallback={<LoadingFallback />}>
				<KitchenModel scene={scene} />
				<Book controlsRef={controlsRef} />
			</Suspense>
			<ContactShadows position={[-10, 0, 0]} opacity={0.35} scale={8} blur={2} far={2} />
			<OrbitControls
				ref={controlsRef}
				makeDefault
				target={[-3, 1.5, 0]}
				enableDamping
				dampingFactor={0.05}
				enablePan={false}
				minDistance={0.5}
				maxDistance={2.5}
				minPolarAngle={Math.PI * 0.35}
				maxPolarAngle={Math.PI * 0.55}
				minAzimuthAngle={-Math.PI * 0.8}
				maxAzimuthAngle={-Math.PI * 0.20}
			/>
		</Canvas>
	)
}