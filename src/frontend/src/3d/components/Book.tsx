import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace, Vector3 } from "three";

import { Page } from "./Page.tsx";
import { useBookPages } from "../hooks/useBookPages.ts";
import type { BookProps } from "../interfaces.ts";
import {
  leatherColorUrl,
  leatherColorUrl1,
  leatherDispUrl,
  leatherDispUrl1,
  leatherNormalUrl,
  leatherNormalUrl1,
  leatherRoughnessUrl,
  leatherRoughnessUrl1,
  logoUrl,
} from "../kitchenAssets";
import { createRecipeTexture } from "../recipeTextures";

const BOOK_COVER_SIZE = {
  width: 0.4,
  height: 0.3,
  thickness: 0.02,
} as const;

const LEATHER_MATERIAL_PROPS = {
  normalScale: [0.6, 0.6],
  metalness: 0.3,
  roughness: 1,
} as const;

const HINGE_MATERIAL_PROPS = {
  normalScale: [0.6, 0.6],
  metalness: 0,
  roughness: 1,
} as const;

function useLogoTexture() {
  // carica la texture del logo usata sulla copertina del libro
  const logoMap = useTexture(logoUrl);
  logoMap.colorSpace = SRGBColorSpace;
  return logoMap;
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
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(1, 1);
  });

  return { colorMap, roughnessMap, normalMap, dispMap };
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
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(1, 1);
  });

  return { colorMap1, roughnessMap1, normalMap1, dispMap1 };
}

export default function Book({ controlsRef, recipes }: BookProps) {
  // limiti iniziali per la camera quando si ruota intorno alla scena
  const originalLimits = useRef({
    minPolarAngle: Math.PI * 0.35,
    maxPolarAngle: Math.PI * 0.55,
    minAzimuthAngle: -Math.PI * 0.8,
    maxAzimuthAngle: -Math.PI * 0.2,
    minDistance: 0.5,
    maxDistance: 2.5,
  });

  function setControlsLimits(limits: Partial<typeof originalLimits.current>) {
    const c = controlsRef.current;
    if (!c) return;
    Object.assign(c, limits);
    c.update();
  }

  // materiali usati per la copertina e la cerniera del libro
  const { colorMap, normalMap, roughnessMap } = useLeatherMaterial();
  const { colorMap1, normalMap1, roughnessMap1 } = useLeatherMaterial1();

  const [isOpen, setIsOpen] = useState(false);
  const coverTopRef = useRef<any>(null);
  const hingeRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);
  const pageProgressRefs = useRef<Array<{ current: number }>>([]);
  const { pageProgress, nextPage, prevPage, closePages } = useBookPages(
    recipes.length,
  );

  // stato dell'animazione di apertura del libro
  const progress = useRef(0);
  const recipeTextures = useMemo(() => {
    return recipes.map((recipe) => {
      const frontMap = createRecipeTexture(
        recipe.title,
        recipe.description,
        recipe.username,
        "#f0d9b0",
        "#fbefe0",
      );
      const backMap = createRecipeTexture("", "", "", "#dfc39b", "#f7ead2");
      return { frontMap, backMap };
    });
  }, [recipes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // chiude il libro con Esc solo quando la camera è ferma
      if (event.key === "Escape" && isOpen && camPhase.current === "idle") {
        event.preventDefault();
        setIsOpen(false);
      }
      // avanti/indietro pagina con le frecce solo se il libro è aperto
      if (event.key === "ArrowRight" && isOpen) {
        event.preventDefault();
        nextPage();
      }
      if (event.key === "ArrowLeft" && isOpen) {
        event.preventDefault();
        prevPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, nextPage, prevPage]);

  useEffect(() => {
    if (!isOpen) {
      closePages();
    }
  }, [isOpen, closePages]);

  const { camera } = useThree();
  const camPhase = useRef<"idle" | "zooming-in" | "zooming-out">("idle");
  const camProgress = useRef(0);

  // posizione iniziale e target della camera prima dell'apertura del libro
  const initialCamPos = useRef(new Vector3(-10, 1.5, 0));
  const initialTarget = useRef(new Vector3(-3, 1.5, 0));

  // posizione target della camera durante l'ingrandimento sul libro
  const zoomedCamPos = useRef(new Vector3(-2.51, 1.3, -0.1));
  const zoomedTarget = useRef(new Vector3(-2.5, 1, -0.1));
  const pageGroupRefs = useRef<Array<any>>([]);

  useFrame((_, delta) => {
    pageProgressRefs.current.forEach((ref, index) => {
      const p = pageProgress.current[index] ?? 0;
      ref.current = p;

      const group = pageGroupRefs.current[index];
      if (group) {
        const zStep = 0.001;
        const yClosed = 0.164;
        const yOpened = 0.166;

        const closedStackZ = 0.01 + (recipes.length - 1 - index) * zStep;
        const openStackZ = 0.01 + index * zStep;

        group.position.z = closedStackZ * (1 - p) + openStackZ * p;
        group.position.y = yClosed * (1 - p) + yOpened * p;
      }
    });
    const camSpeed = 1;

    if (
      camPhase.current === "zooming-in" ||
      camPhase.current === "zooming-out"
    ) {
      const dir = camPhase.current === "zooming-in" ? 1 : -1;
      camProgress.current = Math.max(
        0,
        Math.min(1, camProgress.current + dir * (delta / camSpeed)),
      );
      const t = 1 - Math.pow(1 - camProgress.current, 3);

      // interpolazione dolce della camera e del target quando si fa zoom sul libro
      camera.position.lerpVectors(
        initialCamPos.current,
        zoomedCamPos.current,
        t,
      );
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(
          initialTarget.current,
          zoomedTarget.current,
          t,
        );
        controlsRef.current.update();
      }

      if (camPhase.current === "zooming-in" && camProgress.current >= 1) {
        camPhase.current = "idle";
        setIsOpen(true);
      }

      if (camPhase.current === "zooming-out" && camProgress.current <= 0) {
        camPhase.current = "idle";
        if (controlsRef.current) controlsRef.current.enabled = true;
        setControlsLimits(originalLimits.current);
      }
    }

    // progress di apertura della copertina del libro
    const direction = isOpen ? 1 : -1;
    const wasOpen = progress.current > 0;

    progress.current += direction * delta;
    progress.current = Math.max(0, Math.min(1, progress.current));

    // quando il libro è chiuso e il progresso torna a 0, inizia lo zoom out della camera
    if (wasOpen && progress.current === 0 && camPhase.current === "idle")
      camPhase.current = "zooming-out";

    // easing cubico per chiusura/apertura più morbida
    const eased = 1 - Math.pow(1 - progress.current, 3);
    const angle = eased * -Math.PI;

    if (coverTopRef.current) {
      coverTopRef.current.rotation.x = angle;
      coverTopRef.current.position.y = 0.155;
      const extraSink = 0.02;
      coverTopRef.current.position.z = 0.055 - eased * 0.03 - eased * extraSink;
    }
    if (hingeRef.current) {
      hingeRef.current.visible = progress.current < 0.225;
    }
  });

  const logoMap = useLogoTexture();
  const isCoverHighlighted = !isOpen && hovered && progress.current <= 0.001;
  const canInteractWithBook =
    !isOpen && !!controlsRef.current && camPhase.current === "idle";

  return (
    <group
      position={[-2.5, 1.05, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      // cliccare sul libro avvia l'animazione di zooming e apre la copertina
      onClick={(e) => {
        e.stopPropagation();
        if (camPhase.current !== "idle" || isOpen) return;
        if (controlsRef.current) controlsRef.current.enabled = false;
        setControlsLimits({
          minPolarAngle: 0,
          maxPolarAngle: Math.PI * 0.55,
          minAzimuthAngle: -Infinity,
          maxAzimuthAngle: Infinity,
          maxDistance: 1,
          minDistance: 1,
        });
        camPhase.current = "zooming-in";
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!canInteractWithBook) return;
        controlsRef.current.enabled = false;
      }}
      // riattiva i controlli dell'orbita quando il puntatore viene rilasciato
      onPointerUp={() => {
        if (!canInteractWithBook) return;
        controlsRef.current.enabled = true;
      }}
    >
      <mesh position={[0, 0.155, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.4, 0.05]} />
        <meshStandardMaterial
          map={colorMap}
          normalMap={normalMap}
          roughnessMap={roughnessMap}
          {...LEATHER_MATERIAL_PROPS}
        />
      </mesh>
      <mesh
        position={[0, 0, 0.03]}
        renderOrder={998}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
      >
        {/* area invisibile sopra il libro per catturare hover e click */}
        <boxGeometry args={[0.48, 0.42, 0.08]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>

      {/* copertina bassa (fissa) */}
      <group position={[0, 0.005, 0.005]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry
            args={[
              BOOK_COVER_SIZE.width,
              BOOK_COVER_SIZE.height,
              BOOK_COVER_SIZE.thickness,
            ]}
          />
          <meshStandardMaterial
            map={colorMap}
            normalMap={normalMap}
            roughnessMap={roughnessMap}
            {...LEATHER_MATERIAL_PROPS}
          />
        </mesh>
        {/* outline for hover: evidenzia il libro quando il cursore è sopra e il libro è chiuso */}
        <mesh
          visible={isCoverHighlighted}
          position={[0, 0, 0]}
          renderOrder={999}
          scale={[1.002, 1.002, 1.002]}
        >
          <boxGeometry
            args={[
              BOOK_COVER_SIZE.width,
              BOOK_COVER_SIZE.height,
              BOOK_COVER_SIZE.thickness,
            ]}
          />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.18}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* copertina alta (ruota verso l'alto) */}
      <group
        ref={coverTopRef}
        position={[0, 0.155, 0.055]}
        rotation={[0, 0, 0]}
      >
        {/* cerniera - sparisce quando il libro è completamente aperto */}
        <mesh
          ref={hingeRef}
          position={[0, 0, -0.025]}
          rotation={[0, 0, -Math.PI * 1.5]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry
            args={[0.035, 0.035, 0.4, 16, 1, false, 0, Math.PI]}
          />
          <meshStandardMaterial
            map={colorMap1}
            normalMap={normalMap1}
            roughnessMap={roughnessMap1}
            {...HINGE_MATERIAL_PROPS}
          />
        </mesh>

        <mesh
          visible={isCoverHighlighted}
          position={[0, 0, -0.025]}
          rotation={[0, 0, -Math.PI * 1.5]}
          renderOrder={999}
          scale={[1.004, 1.004, 1.004]}
        >
          <cylinderGeometry
            args={[0.035, 0.035, 0.4, 16, 1, false, 0, Math.PI]}
          />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.16}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh position={[0, -0.15, 0]} castShadow receiveShadow>
          <boxGeometry
            args={[
              BOOK_COVER_SIZE.width,
              BOOK_COVER_SIZE.height,
              BOOK_COVER_SIZE.thickness,
            ]}
          />
          <meshStandardMaterial
            map={colorMap}
            normalMap={normalMap}
            roughnessMap={roughnessMap}
            {...LEATHER_MATERIAL_PROPS}
          />
        </mesh>
        {/* outline for hover - follows the coverTop transforms */}
        <mesh
          visible={isCoverHighlighted}
          position={[0, -0.15, 0]}
          renderOrder={999}
          scale={[1.002, 1.002, 1.002]}
        >
          <boxGeometry args={[0.4, 0.3, 0.02]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.18}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh position={[0.01, -0.1455, 0.011]} rotation={[0, 0, -Math.PI / 2]}>
          <planeGeometry args={[0.35, 0.2]} />
          <meshStandardMaterial
            map={logoMap}
            transparent
            metalness={0.1}
            toneMapped={true}
            alphaTest={0.5}
          />
        </mesh>
      </group>

      {/* pagine all'interno del libro, ciascuna con texture frontale e retro */}
      {recipes.map((recipe, index) => {
        const zOffset = 0.1 + (recipes.length - 1 - index) * 0.001;
        const pageRef = (pageProgressRefs.current[index] ??= { current: 0 });
        const textures = recipeTextures[index];
        if (!textures?.frontMap || !textures.backMap) return null;

        return (
          <group
            key={recipe.id}
            ref={(el) => (pageGroupRefs.current[index] = el)}
            position={[0, 0.164, zOffset + 0.01]}
          >
            <Page
              progressRef={pageRef}
              frontMap={textures.frontMap}
              backMap={textures.backMap}
              width={0.39}
              height={0.28}
              position={[0, -0.15, 0.0052]}
            />
          </group>
        );
      })}
    </group>
  );
}
