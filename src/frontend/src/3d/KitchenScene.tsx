import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows, Text } from '@react-three/drei'
import { Object3D, BackSide, AdditiveBlending } from 'three'
import kitchenUrl from '../assets/kitchen3.0.glb?url'
import titleFontUrl from '../assets/Playfair-ExtraBoldItalic.ttf?url'

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
	const [isOpen, setIsOpen] = useState(false)
	const coverBottomRef = useRef<any>(null)
	const coverTopRef = useRef<any>(null)
	const hingeRef = useRef<any>(null)
	const [hovered, setHovered] = useState(false)

	const progress = useRef(0)

	useFrame((_, delta) => {
		const targetProgress = isOpen ? 1 : 0
		const speed = 0.8

		const direction = targetProgress === 1 ? 1 : -1
		progress.current += direction * (delta / speed)
		progress.current = Math.max(0, Math.min(1, progress.current))

		const eased = 1 - Math.pow(1 - progress.current, 3)
		const angle = eased * -Math.PI

		if (coverTopRef.current) {
			coverTopRef.current.rotation.x = angle
			coverTopRef.current.position.y = 0.155
			coverTopRef.current.position.z = 0.055 - (eased * 0.03)
			if (isOpen)
			{
				for (let i = 0; i < 20; i++)
				{
					coverTopRef.current.position.z -= (targetProgress * 0.001)
				}
			}
		}
		if (hingeRef.current) {
			hingeRef.current.visible = progress.current < 0.225
		}
	})
	
	return (
		<group
			position={[-2.5, 1.05, 0]}
			rotation={[-Math.PI / 2, 0, 0]}
			onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
			onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
			onClick={(e) => {
				e.stopPropagation();
				setIsOpen(prev => !prev)
			}}
			onPointerDown={(e) => {
				e.stopPropagation();
				if (controlsRef.current) controlsRef.current.enabled = false
			}}
			onPointerUp={(e) => {
				if (controlsRef.current) controlsRef.current.enabled = true
			}}
			>

			{/* copertina bassa (fissa) */}
			<group ref={coverBottomRef} position={[0, 0.005, 0.005]} rotation={[0, 0, 0]}>
				<mesh position={[0, 0, 0]} castShadow receiveShadow>
					<boxGeometry args={[0.4, 0.3, 0.02]} />
					<meshStandardMaterial color="#5a2e1b" />
				</mesh>
				{/* outline for hover */}
				<mesh visible={hovered} position={[0, 0, 0]} renderOrder={999} scale={[1.03, 1.03, 1.06]}>
					<boxGeometry args={[0.4, 0.3, 0.02]} />
					<meshBasicMaterial color="#ffd97a" side={BackSide} transparent opacity={0.95} blending={AdditiveBlending} toneMapped={false} />
				</mesh>
			</group>

			{/* copertina alta (ruota verso l'alto) */}
			<group ref={coverTopRef} position={[0, 0.155, 0.055]} rotation={[0, 0, 0]}>
				{/* cerniera - sparisce quando il libro è completamente aperto */}
				<mesh ref={hingeRef} position={[0, 0, -0.025]} rotation={[0, 0, -Math.PI * 1.5]} castShadow receiveShadow>
					<cylinderGeometry args={[0.035, 0.035, 0.4, 16, 1, false, 0, Math.PI]} />
					<meshStandardMaterial color="#3d1f10" />
				</mesh>

				<mesh position={[0, -0.15, 0]} castShadow receiveShadow>
					<boxGeometry args={[0.4, 0.3, 0.02]} />
					<meshStandardMaterial color="#5a2e1b" />
				</mesh>
				{/* outline for hover - follows the coverTop transforms */}
				<mesh visible={hovered} position={[0, -0.15, 0]} renderOrder={999} scale={[1.03, 1.03, 1.06]}> 
					<boxGeometry args={[0.4, 0.3, 0.02]} />
					<meshBasicMaterial color="#ffd97a" side={BackSide} transparent opacity={0.95} blending={AdditiveBlending} toneMapped={false} />
				</mesh>

				<Text
					position={[0, -0.14, 0.011]}
					rotation={[0, 0, -Math.PI / 2]}
					font={titleFontUrl}
					fontSize={0.07}
					textAlign="center"
					color="#f5e6c8"
					anchorX="center"
					anchorY="middle"
				>
					{"WeCook"}
				</Text>
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
			<ambientLight intensity={1.7} color="#fff5e0" />

			<directionalLight
			position={[-9, 4, 1]}
			intensity={3}
			color="#ffd9a8"
			target-position={[-2.5, 1.05, 0]}
			castShadow
			shadow-mapSize-width={2048}
			shadow-mapSize-height={2048}
			shadow-camera-left={-10}
			shadow-camera-right={10}
			shadow-camera-top={10}
			shadow-camera-bottom={-10}
			/>

			<directionalLight position={[-5, 3, 4]} intensity={2} color="#ffffff" />
			<directionalLight position={[-5, 3, -4]} intensity={1.5} color="#ffe8cc" />

			<pointLight position={[-2.5, 2.5, 0]} intensity={2} color="#ffe4b0" distance={4} decay={2} />

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
				minDistance={1}
				maxDistance={2.5}
				minPolarAngle={Math.PI * 0.35}
				maxPolarAngle={Math.PI * 0.55}
				minAzimuthAngle={-Math.PI * 0.8}
				maxAzimuthAngle={-Math.PI * 0.20}
			/>
		</Canvas>
	)
}