import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows, Text } from '@react-three/drei'
import { Object3D } from 'three'
import kitchenUrl from '../assets/kitchen3.0.glb?url'
import titleFontUrl from '../assets/Playfair-ExtraBoldItalic.ttf?url'

function Book() {
	const coverGroupRef = useRef<any>(null)
	const currentAngle = useRef(0)
	const targetAngle = -Math.PI * 0.25 // ~45°, "apertura a metà"

	useFrame(() => {
		// lerp verso il target
		currentAngle.current += (targetAngle - currentAngle.current) * 0.05
		if (coverGroupRef.current) {
			coverGroupRef.current.rotation.x = currentAngle.current
		}
	})

	return (
		<group position={[-2.5, 1.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>

			{/* cerniera */}
			<mesh position={[0, 0.155, 0.0305]} rotation={[0, 0, -Math.PI * 1.5]} castShadow receiveShadow>
				<cylinderGeometry args={[0.035, 0.035, 0.4, 16, 1, false, 0, Math.PI]} />
				<meshStandardMaterial color="#3d1f10" />
			</mesh>

			{/* copertina bassa (fissa) */}
			<mesh position={[0, 0.005, 0.005]} castShadow receiveShadow>
				<boxGeometry args={[0.4, 0.3, 0.02]} />
				<meshStandardMaterial color="#5a2e1b" />
			</mesh>

			{/* copertina alta -> ora è un hinge che ruota */}
			<group ref={coverGroupRef} position={[0, 0.155, 0.055]} rotation={[0, 0, 0]}>
				<mesh position={[0, -0.15, 0]} castShadow receiveShadow>
					<boxGeometry args={[0.4, 0.3, 0.02]} />
					<meshStandardMaterial color="#5a2e1b" />
				</mesh>

				{/* il titolo segue la copertina, quindi va dentro lo stesso group */}
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
					{"THE\nCOOK\nBOOK"}
				</Text>
			</group>

			{/* fogli */}
			<mesh position={[0, 0.005, 0.03]} castShadow receiveShadow>
				<boxGeometry args={[0.4, 0.3, 0.03]} />
				<meshStandardMaterial color="#d4d4d4" />
			</mesh>
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
			<ambientLight intensity={1.2} color="#ffffff" />

			<directionalLight
				position={[-100, 20, 0]}
				intensity={5}
				color="#ffd9a8"
				target-position={[-3, 1.5, 0]}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
				shadow-camera-left={-20}
				shadow-camera-right={20}
				shadow-camera-top={20}
				shadow-camera-bottom={-20}
			/>

			<pointLight position={[-10.5, 2, 1]} intensity={0.7} color="#fff8dc" distance={15} decay={2} />
			<pointLight position={[-10.5, 2, -1]} intensity={0.7} color="#fff8dc" distance={15} decay={2} />
			<pointLight position={[-10.2, 1.5, 0]} intensity={0.5} color="#fffacd" distance={12} decay={2} />

			<Suspense fallback={<LoadingFallback />}>
				<KitchenModel scene={scene} />
				<Book />
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