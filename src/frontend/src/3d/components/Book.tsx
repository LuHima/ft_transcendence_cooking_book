import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  Color,
  DoubleSide,
  MathUtils,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { Group, MeshBasicMaterial } from "three";

import { Page } from "./Page.tsx";
import { useBookPages } from "../hooks/useBookPages.ts";
import type { BookProps, ApiPageButtonProps } from "../interfaces.ts";
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

const BUTTON_BASE_COLOR = new Color("#b6733d");
const BUTTON_HOVER_COLOR = new Color("#ffd8a2");
const BUTTON_DISABLED_COLOR = new Color("#765d4d");
const ICON_BASE_COLOR = new Color("#f4e4ce");
const ICON_HOVER_COLOR = new Color("#fff6df");
const ICON_DISABLED_COLOR = new Color("#d2b799");

// Component for the "Next" and "Previous" buttons on the book pages
function ApiPageButton({
  direction,
  position,
  faceAway = false,
  visible,
  disabled,
  onClick,
}: ApiPageButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverProgress = useRef(0);
  const visualRef = useRef<Group>(null);
  const buttonMaterialRef = useRef<MeshBasicMaterial>(null);
  const iconMaterialsRef = useRef<Array<MeshBasicMaterial | null>>([]);

  useFrame((_, delta) => {
    hoverProgress.current = MathUtils.damp(
      hoverProgress.current,
      isHovered && !disabled ? 1 : 0,
      12,
      delta,
    );
    const progress = hoverProgress.current;

    visualRef.current?.scale.setScalar(1 + progress * 0.12);
    buttonMaterialRef.current?.color.lerpColors(
      disabled ? BUTTON_DISABLED_COLOR : BUTTON_BASE_COLOR,
      BUTTON_HOVER_COLOR,
      progress,
    );
    iconMaterialsRef.current.forEach((material) => {
      material?.color.lerpColors(
        disabled ? ICON_DISABLED_COLOR : ICON_BASE_COLOR,
        ICON_HOVER_COLOR,
        progress,
      );
    });
  });

  if (!visible) return null;

  const isPrevious = direction === "previous";
  const iconParts = isPrevious
    ? [
        {
          position: [0.004, -0.001, 0] as [number, number, number],
          angle: Math.PI / 4,
        },
        {
          position: [-0.004, -0.001, 0] as [number, number, number],
          angle: -Math.PI / 4,
        },
      ]
    : [
        {
          position: [0.004, -0.001, 0] as [number, number, number],
          angle: Math.PI / 4,
        },
        {
          position: [-0.004, -0.001, 0] as [number, number, number],
          angle: -Math.PI / 4,
        },
      ];
  return (
    <group position={position} rotation={[0, faceAway ? Math.PI : 0, 0]}>
      <mesh
        position={direction === "previous" ? [0, 0.017, 0.05] : [0, 0.01, 0.05]}
        onPointerOver={(event) => {
          event.stopPropagation();
          if (!disabled) setIsHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setIsHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) onClick();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <circleGeometry args={[0.026, 32]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          colorWrite={false}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <group ref={visualRef}>
        <mesh raycast={() => null}>
          <circleGeometry args={[0.026, 32]} />
          <meshBasicMaterial
            ref={buttonMaterialRef}
            color={BUTTON_BASE_COLOR}
            toneMapped={false}
          />
        </mesh>
        {iconParts.map((part, index) => (
          <mesh
            key={index}
            position={part.position}
            rotation={[0, 0, part.angle]}
            raycast={() => null}
          >
            <boxGeometry args={[0.013, 0.003, 0.003]} />
            <meshBasicMaterial
              ref={(material) => {
                iconMaterialsRef.current[index] = material;
              }}
              color={ICON_BASE_COLOR}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

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

export default function Book({
  controlsRef,
  recipes,
  hasPreviousPage,
  hasNextPage,
  isChangingApiPage,
  onPreviousApiPage,
  onNextApiPage,
  currentApiPage,
}: BookProps) {
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
  const [turnedPageCount, setTurnedPageCount] = useState(0);
  const trackedTurnedPageCount = useRef(0);
  const pageProgressRefs = useRef<Array<{ current: number }>>([]);
  const { pageProgress, currentPage, nextPage, prevPage, closePages } =
    useBookPages(recipes.length, currentApiPage);

  useEffect(() => {
    trackedTurnedPageCount.current = 0;
    setTurnedPageCount(0);
  }, [currentApiPage, recipes.length]);

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
    if (trackedTurnedPageCount.current !== currentPage.current) {
      trackedTurnedPageCount.current = currentPage.current;
      setTurnedPageCount(currentPage.current);
    }

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
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      <mesh position={[0, 0.155, 0.016]} rotation={[Math.PI * 2, 0, 0]}>
        <planeGeometry args={[0.37, 0.0025]} />
        <meshStandardMaterial
          color="#3f2200"
          normalMap={normalMap}
          roughnessMap={roughnessMap}
          {...LEATHER_MATERIAL_PROPS}
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
        <ApiPageButton
          direction="next"
          position={[0, -0.1, 0.011]}
          visible={hasNextPage}
          disabled={isChangingApiPage || turnedPageCount < recipes.length}
          onClick={onNextApiPage}
        />
      </group>

      {/* copertina alta (ruota verso l'alto) */}
      <group
        ref={coverTopRef}
        position={[0, 0.155, 0.055]}
        rotation={[0, 0, 0]}
      >
        {/* cerniera - sparisce quando il libro è completamente aperto */}
        <group ref={hingeRef}>
          <mesh
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
            position={[0, 0, -0.025]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[0.4, 0.04]} />
            <meshStandardMaterial
              map={colorMap1}
              normalMap={normalMap1}
              roughnessMap={roughnessMap1}
              {...HINGE_MATERIAL_PROPS}
            />
          </mesh>
        </group>

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
        <ApiPageButton
          direction="previous"
          position={[0, -0.25, -0.011]}
          faceAway
          visible={hasPreviousPage}
          disabled={isChangingApiPage}
          onClick={onPreviousApiPage}
        />
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
