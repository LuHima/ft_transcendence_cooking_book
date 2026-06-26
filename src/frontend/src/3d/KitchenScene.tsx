import { Suspense, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows } from '@react-three/drei'
import { Object3D, Vector3, Raycaster } from 'three'
import kitchenUrl from '../assets/kitchen3.0.glb?url'

function Book() {
	return (
		<group position={[-2.2, 0.95, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
			{/* pagina / copertina piatta */}
			<mesh castShadow receiveShadow>
				<boxGeometry args={[0.9, 0.01, 0.6]} />
				<meshStandardMaterial color="#8b4a2d" />
			</mesh>

			{/* bordo */}
			<mesh position={[0, 0.005, 0]} castShadow receiveShadow>
				<boxGeometry args={[0.92, 0.002, 0.62]} />
				<meshStandardMaterial color="#5a2e1b" />
			</mesh>

			{/* pagina interna */}
			<mesh position={[0, 0.008, 0]} castShadow receiveShadow>
				<boxGeometry args={[0.86, 0.001, 0.56]} />
				<meshStandardMaterial color="#f5e6c8" />
			</mesh>
		</group>
	)
}

function KitchenModel({ scene }: { scene: Object3D }) {
	scene.traverse((c: any) => {
		if (c.isMesh) {
			c.castShadow = true
			c.receiveShadow = true
		}
	})
	return (
		<primitive object={scene} dispose={null} />
	)
}

function LoadingFallback() {
	return (
		<mesh>
			<boxGeometry args={[1, 1, 1]} />
			<meshBasicMaterial color="white" wireframe />
		</mesh>
	)
}

function CameraCollisionDetector({ scene, controlsRef }: { scene: Object3D; controlsRef: any }) {
	const { camera } = useThree()
	const raycasterRef = useRef(new Raycaster())
	const minDistance = 0.8

	useFrame(() => {
		if (!controlsRef?.current) return

		try {
			const target = new Vector3()
			controlsRef.current.getTarget(target)

			const camPos = camera.position.clone()
			const direction = camPos.clone().sub(target).normalize()
			const distanceToTarget = camPos.distanceTo(target)

			// Cast ray dal target verso la camera
			raycasterRef.current.set(target, direction)
			const hits = raycasterRef.current.intersectObject(scene, true)

			if (hits.length > 0) {
				const closestHit = hits[0]
				if (closestHit.distance < minDistance) {
					// Posiziona camera a distanza sicura
					const newPos = target.clone().addScaledVector(direction, Math.max(closestHit.distance - 0.1, 0.2))
					camera.position.lerp(newPos, 0.3)
					camera.updateMatrixWorld()
				}
			}
		} catch (error) {
			// Silently continue
		}
	})

	return null
}

export default function Scene() {
	const { scene } = useGLTF(kitchenUrl)
	const controlsRef = useRef<any>(null)

	return (
		<Canvas shadows dpr={[1, 2]} camera={{ position: [-10, 1.5, 0], fov: 45 }}>
			{/* Luce ambientale */}
			<ambientLight intensity={1} color="#ffffff" />
			
			{/* Luce direzionale (sole) bassa */}
			<directionalLight
				position={[-5, 3, 0]}
				intensity={3}
				color="#ffd9a8"
				target-position={[-3, 1.2, 0]}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
				shadow-camera-left={-20}
				shadow-camera-right={20}
				shadow-camera-top={20}
				shadow-camera-bottom={-20}
			/>
			
			<directionalLight position={[-5, 8, -5]} intensity={0.7} color="#e0f1ff" />
			<pointLight position={[0, 3.5, 2]} intensity={0.8} color="#fffacd" distance={15} decay={2} />
			<pointLight position={[5, 3.5, 0]} intensity={0.6} color="#fff8dc" distance={12} decay={2} />
			<pointLight position={[-5, 3.5, 0]} intensity={0.6} color="#fff8dc" distance={12} decay={2} />
			<pointLight position={[0, 2.5, -6]} intensity={0.5} color="#e0f1ff" distance={12} decay={2} />
			
			<Suspense fallback={<LoadingFallback />}>
				<KitchenModel scene={scene} />
				<CameraCollisionDetector scene={scene} controlsRef={controlsRef} />
				<Book />
			</Suspense>
			<ContactShadows position={[-10, 0, 0]} opacity={0.35} scale={8} blur={2} far={2} />
			<OrbitControls
				ref={controlsRef}
				makeDefault
				target={[-3, 1.2, 0]}
				enableDamping
				dampingFactor={0.05}
				enablePan={false}
				minDistance={1}
				maxDistance={6}
				minPolarAngle={Math.PI * 0.47}
  				maxPolarAngle={Math.PI * 0.55}
				minAzimuthAngle={-Math.PI * 0.65}
  				maxAzimuthAngle={-Math.PI * 0.20}
			/>
		</Canvas>
	)
}
