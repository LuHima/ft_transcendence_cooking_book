import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows, useTexture, Environment } from '@react-three/drei'
import { CanvasTexture, Object3D, RepeatWrapping, SRGBColorSpace, Vector3, NoToneMapping } from 'three'
import { Page } from './Page'
import { useBookPages } from './hooks/useBookPages'

// Import delle risorse 3D e delle texture dalla cartella assets
// Le texture vengono usate per il materiale del libro e per il logo sulla copertina
// useGLTF carica il modello della cucina in formato GLB
// OrbitControls gestisce la vista orbitale attorno alla scena

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
	// carica la texture del logo usata sulla copertina del libro
	const logoMap = useTexture(logoUrl)
	logoMap.colorSpace = SRGBColorSpace
	return logoMap
}

function useLeatherMaterial() {
	// carica le texture della pelle per la copertina principale del libro
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
	// carica un altro set di texture per il materiale della cerniera del libro
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

// elenco delle ricette usato per generare le pagine del libro
const recipes = [
	{ id: 1, title: "Pasta al Pomodoro" },
	{ id: 2, title: "Risotto ai Funghi" },
	{ id: 3, title: "Tiramisù" },
	{ id: 4, title: "Pasta al Pomodoro" },
	{ id: 5, title: "Risotto ai Funghi" },
	{ id: 6, title: "Tiramisù" },
	{ id: 7, title: "Pasta al Pomodoro" },
	{ id: 8, title: "Risotto ai Funghi" },
	{ id: 9, title: "Tiramisù" },
	{ id: 10, title: "Pasta al Pomodoro" },
	{ id: 11, title: "Risotto ai Funghi" },
	{ id: 12, title: "Tiramisù" },
	{ id: 13, title: "Pasta al Pomodoro" },
	{ id: 14, title: "Risotto ai Funghi" },
	{ id: 15, title: "Tiramisù" },
	{ id: 16, title: "Pasta al Pomodoro" },
	{ id: 17, title: "Risotto ai Funghi" },
	{ id: 18, title: "Tiramisù" },
	{ id: 19, title: "Pasta al Pomodoro" },
	{ id: 20, title: "Risotto ai Funghi" },
	{ id: 21, title: "Tiramisù" },
	{ id: 22, title: "Pasta al Pomodoro" },
	{ id: 23, title: "Risotto ai Funghi" },
	{ id: 24, title: "Tiramisù" },
	{ id: 25, title: "Pasta al Pomodoro" },
	{ id: 26, title: "Risotto ai Funghi" },
	{ id: 27, title: "Tiramisù" },
	{ id: 28, title: "Pasta al Pomodoro" },
	{ id: 29, title: "Risotto ai Funghi" },
	{ id: 30, title: "Tiramisù" },
	{ id: 31, title: "Pasta al Pomodoro" },
	{ id: 32, title: "Risotto ai Funghi" },
	{ id: 33, title: "Tiramisù" },
	{ id: 34, title: "Pasta al Pomodoro" },
	{ id: 35, title: "Risotto ai Funghi" },
]

function createRecipeTexture(title: string, accent: string, background: string) {
	// crea un canvas 2D per generare una texture al volo
	const canvas = document.createElement('canvas')
	canvas.width = 512
	canvas.height = 512

	const ctx = canvas.getContext('2d')
	if (!ctx) return null

	// sfondo marroncino per dare un aspetto di carta vecchia
	const gradient = ctx.createLinearGradient(0, 0, 512, 512)
	gradient.addColorStop(0, background)
	gradient.addColorStop(1, accent)
	ctx.fillStyle = gradient
	ctx.fillRect(0, 0, 512, 512)

	// titolo principale della ricetta, centrato nella texture
	ctx.fillStyle = '#4a331f'
	ctx.font = 'bold 48px serif'
	ctx.textAlign = 'center'
	ctx.fillText(title, 256, 210)

	// testo secondario fisso sotto il titolo
	ctx.font = '24px serif'
	ctx.fillStyle = '#5a442b'
	ctx.fillText('Ricetta del giorno', 256, 300)

	// bordo leggermente scuro attorno alla pagina per farla sembrare antica
	ctx.strokeStyle = '#a58362'
	ctx.lineWidth = 6
	ctx.strokeRect(42, 42, 428, 428)

	// converte il canvas in una CanvasTexture Three.js
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	texture.needsUpdate = true
	return texture
}

function Book({controlsRef} : BookProps) {
	// limiti iniziali per la camera quando si ruota intorno alla scena
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
	
	// materiali usati per la copertina e la cerniera del libro
	const { colorMap, normalMap, roughnessMap } = useLeatherMaterial()
	const { colorMap1, normalMap1, roughnessMap1 } = useLeatherMaterial1()

	const [isOpen, setIsOpen] = useState(false)
	const coverBottomRef = useRef<any>(null)
	const coverTopRef = useRef<any>(null)
	const hingeRef = useRef<any>(null)
	const [hovered, setHovered] = useState(false)
	const pageProgressRefs = useRef<Array<{ current: number }>>([])
	const { pageProgress, nextPage, prevPage } = useBookPages(recipes.length)

	// stato dell'animazione di apertura del libro
	const progress = useRef(0)
	const recipeTextures = useMemo(() => {
		return recipes.map((recipe) => {
			const frontMap = createRecipeTexture(recipe.title, '#f0d9b0', '#fbefe0')
			const backMap = createRecipeTexture(`Recipe ${recipe.id}`, '#dfc39b', '#f7ead2')
			return { frontMap, backMap }
		})
	}, [])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// chiude il libro con Esc solo quando la camera è ferma
			if (event.key === 'Escape' && isOpen && camPhase.current === 'idle') {
				event.preventDefault()
				setIsOpen(false)
			}
			// avanti/indietro pagina con le frecce solo se il libro è aperto
			if (event.key === 'ArrowRight' && isOpen) {
				event.preventDefault()
				nextPage()
			}
			if (event.key === 'ArrowLeft' && isOpen) {
				event.preventDefault()
				prevPage()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isOpen, nextPage, prevPage])

	const { camera } = useThree()
	const camPhase = useRef<'idle' | 'zooming-in' | 'zooming-out'>('idle')
	const camProgress = useRef(0)

	// posizione iniziale e target della camera prima dell'apertura del libro
	const initialCamPos = useRef(new Vector3(-10, 1.5, 0))
	const initialTarget = useRef(new Vector3(-3, 1.5, 0))

	// posizione target della camera durante l'ingrandimento sul libro
	const zoomedCamPos = useRef(new Vector3(-2.51, 1.3, -0.1))
	const zoomedTarget = useRef(new Vector3(-2.5, 1, -0.1))
		const pageGroupRefs = useRef<Array<any>>([])

		useFrame((_, delta) => {
			pageProgressRefs.current.forEach((ref, index) => {
				const p = pageProgress.current[index] ?? 0
				if (ref) ref.current = p

				const group = pageGroupRefs.current[index]
				if (group) {
					const zStep = 0.001
					const flipped = p > 0.5
					group.position.z = flipped
						? 0.01 - (index + 1) * zStep          // girate: stack invertito, vicino alla copertina anteriore
						: 0.01 + (recipes.length - 1 - index) * zStep // non girate: stack normale
			}
		})
		const camSpeed = 1

		if (camPhase.current === 'zooming-in' || camPhase.current === 'zooming-out') {
			const dir = camPhase.current ==='zooming-in' ? 1 : -1
			camProgress.current = Math.max(0, Math.min(1, camProgress.current + dir * (delta / camSpeed)))
			const t = 1 - Math.pow(1 - camProgress.current, 3);

			// interpolazione dolce della camera e del target quando si fa zoom sul libro
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

		// progress di apertura della copertina del libro
		const targetProgress = isOpen ? 1 : 0
		const speed = 1
		const direction = targetProgress === 1 ? 1 : -1
		const wasOpen = progress.current > 0

		progress.current += direction * (delta / speed)
		progress.current = Math.max(0, Math.min(1, progress.current))

		// quando il libro è chiuso e il progresso torna a 0, inizia lo zoom out della camera
		if (wasOpen && progress.current === 0 && camPhase.current == 'idle')
			camPhase.current = 'zooming-out'

		// easing cubico per chiusura/apertura più morbida
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
			// cliccare sul libro avvia l'animazione di zooming e apre la copertina
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
			// riattiva i controlli dell'orbita quando il puntatore viene rilasciato
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
				{/* area invisibile sopra il libro per catturare hover e click */}
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
				{/* outline for hover: evidenzia il libro quando il cursore è sopra e il libro è chiuso */}
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

			{/* pagine all'interno del libro, ciascuna con texture frontale e retro */}
			{recipes.map((recipe, index) => {
				const zOffset =  0.01 + (recipes.length - 1 - index) * 0.001
				const pageRef = (pageProgressRefs.current[index] ??= { current: 0 })
				const textures = recipeTextures[index]
				if (!textures?.frontMap || !textures.backMap) return null

				return (
					<group key={recipe.id} position={[0, 0.164, zOffset + 0.01]}>
						<Page
							progressRef={pageRef}
							frontMap={textures.frontMap}
							backMap={textures.backMap}
							width={0.39}
							height={0.28}
							position={[0, -0.15, 0.0005]}
						/>
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
			if (c.isLight) {
				c.castShadow = true
				if (c.shadow) {
					c.shadow.mapSize.set(1024, 1024)
					c.shadow.camera.near = 0.1
					c.shadow.camera.far = 20
					c.shadow.bias = -0.001
					c.shadow.normalBias = 0.02
	}
}
		})
	}, [scene])
	return <primitive object={scene} dispose={null} />
}

function LoadingFallback() {
	// mesh di fallback mostrata mentre il modello è in caricamento
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
	const [isSkylightOn, setIsSkylightOn] = useState(true)

	return (
		<div className="relative h-full w-full">
			<Canvas shadows dpr={[1, 2]} camera={{ position: [-10, 1.5, 0], fov: 45 }}>
				<Environment preset="apartment" environmentIntensity={0.1} />
				<ambientLight intensity={0.2} color="#ffffff" />

				{/* luci soffuse in background */}
				<pointLight position={[-1.85, 1.8, -0.65]} intensity={50} color="#4e310b" distance={4} decay={2} />
				<pointLight position={[-1.85, 1.8, 1.25]} intensity={50} color="#4e310b" distance={4} decay={2} />
				<pointLight position={[-1.85, 1.8, 3.2]} intensity={50} color="#4e310b" distance={4} decay={2} />

				{/* occhio di bue */}
				<pointLight
					position={[-2.5, 2, -0.1]}
					intensity={isSkylightOn ? 100 : 0}
					color="#4e310b"
					distance={4}
					decay={2}
				/>
				
				<Suspense fallback={<LoadingFallback />}>
					<KitchenModel scene={scene} />
					<Book controlsRef={controlsRef} />
				</Suspense>

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

			<button
				type="button"
				onClick={() => setIsSkylightOn((value) => !value)}
				// absolute: lo posiziona liberamente nella pagina
				// left-4 top-4: lo sposta in alto a sinistra
				// z-10: lo mette sopra agli altri elementi
				// rounded-full: lo rende tondo/ovalizzato
				// border border-[#d8b97a]: aggiunge un bordo colorato
				// bg-[#1f140a]/90: sfondo scuro quasi nero con trasparenza
				// px-4 py-2: padding orizzontale e verticale
				// text-sm font-medium text-[#f7e8c8]: testo piccolo e medio, colore chiaro
				// shadow-lg: ombra pronunciata
				// backdrop-blur: effetto sfocatura sullo sfondo dietro il pulsante
				// transition hover:bg-[#2c1f11]: animazione al passaggio del mouse
				className="absolute left-4 top-4 z-10 rounded-full border border-[#d8b97a] bg-[#1f140a]/90 px-4 py-2 text-sm font-medium text-[#f7e8c8] shadow-lg backdrop-blur transition hover:bg-[#2c1f11]"
			>
				Occhio di bue: {isSkylightOn ? 'ON' : 'OFF'}
			</button>
		</div>
	)
}