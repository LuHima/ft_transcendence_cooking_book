import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import { DefaultLoadingManager, Group, PCFShadowMap, SpotLight } from "three";

import KitchenModel from "./KitchenModel.tsx";
import LoadingOverlay from "./LoadingOverlay.tsx";
import { SceneReady } from "./LoadingOverlay.tsx";
import { SceneLights } from "./SceneLights.tsx";
import Book from "./Book.tsx";
import "../styles.css";

import type {
  fetchedValues,
  Recipe,
  SceneContentProps,
} from "../interfaces.ts";

import kitchenUrl from "../../assets/kitchen3.1.glb?url";

async function fetchData(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }

  return response.json();
}

function SceneContent({ controlsRef, recipes }: SceneContentProps) {
  const { scene } = useGLTF(kitchenUrl);

  return (
    <>
      <KitchenModel scene={scene} />
      <Book controlsRef={controlsRef} recipes={recipes} />
    </>
  );
}

export default function Scene() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const assetProgressRef = useRef(0);
  const assetsActiveRef = useRef(true);
  const controlsRef = useRef<any>(null);
  const sideLightRef = useRef<SpotLight | null>(null);
  const sideTargetRef = useRef<Group | null>(null);
  const [isBullseyeOn, setIsBullseyeOn] = useState(true);

  useEffect(() => {
    const previousOnStart = DefaultLoadingManager.onStart;
    const previousOnProgress = DefaultLoadingManager.onProgress;
    const previousOnLoad = DefaultLoadingManager.onLoad;
    const previousOnError = DefaultLoadingManager.onError;

    DefaultLoadingManager.onStart = (_url, loaded, total) => {
      assetsActiveRef.current = true;
      assetProgressRef.current = total > 0 ? (loaded / total) * 100 : 0;
    };
    DefaultLoadingManager.onProgress = (_url, loaded, total) => {
      assetProgressRef.current = total > 0 ? (loaded / total) * 100 : 0;
    };
    DefaultLoadingManager.onLoad = () => {
      assetProgressRef.current = 100;
      assetsActiveRef.current = false;
    };
    DefaultLoadingManager.onError = () => {
      assetsActiveRef.current = false;
    };

    return () => {
      DefaultLoadingManager.onStart = previousOnStart;
      DefaultLoadingManager.onProgress = previousOnProgress;
      DefaultLoadingManager.onLoad = previousOnLoad;
      DefaultLoadingManager.onError = previousOnError;
    };
  }, []);

  useEffect(() => {
    fetchData("/api/recipes/page?value=1")
      .then((loadedRecipes: fetchedValues) => {
        setRecipes(loadedRecipes.returnPage);
      })
      .catch((error) => {
        console.error("Failed to load recipes:", error);
      })
      .finally(() => {
        setRecipesLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (sideLightRef.current && sideTargetRef.current) {
      sideLightRef.current.target = sideTargetRef.current;
      sideLightRef.current.target.updateMatrixWorld();
    }
  }, []);

  return (
    <div className="relative h-full w-full">
      <button
        type="button"
        onClick={() => setIsBullseyeOn((prev) => !prev)}
        className="absolute left-4 top-4 z-10 rounded-full border border-amber-200/60 bg-[#2b1a0d]/80 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-amber-100 shadow-lg backdrop-blur-sm transition hover:bg-[#3b260f]"
      >
        {isBullseyeOn ? "Occhio di bue: on" : "Occhio di bue: off"}
      </button>

      <Canvas
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-[#120d09] px-6 text-center text-amber-100">
            <div className="max-w-lg space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-200/80">
                3D preview unavailable
              </p>
              <h2 className="text-2xl font-semibold text-amber-50">
                WebGL is disabled in this browser
              </h2>
              <p className="text-sm text-amber-100/80">
                The kitchen scene needs a working WebGL context to render the 3D
                cookbook experience.
              </p>
            </div>
          </div>
        }
        shadows={{ type: PCFShadowMap }}
        dpr={[1, 2]}
        camera={{ position: [-10, 1.5, 0], fov: 45 }}
      >
        <SceneLights
          isBullseyeOn={isBullseyeOn}
          sideLightRef={sideLightRef}
          sideTargetRef={sideTargetRef}
        />

        {recipesLoaded && (
          <Suspense fallback={null}>
            <Environment preset="apartment" environmentIntensity={0.1} />
            <SceneContent controlsRef={controlsRef} recipes={recipes} />
            <SceneReady onReady={() => setSceneReady(true)} />
          </Suspense>
        )}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[-3, 1.5, 0]}
          enableDamping
          dampingFactor={0.05}
          // enablePan={false}
          // minDistance={0.5}
          // maxDistance={2.5}
          // minPolarAngle={Math.PI * 0.35}
          // maxPolarAngle={Math.PI * 0.55}
          // minAzimuthAngle={-Math.PI * 0.8}
          // maxAzimuthAngle={-Math.PI * 0.2}
        />
      </Canvas>
      <LoadingOverlay
        recipesLoaded={recipesLoaded}
        sceneReady={sceneReady}
        progressRef={assetProgressRef}
        activeRef={assetsActiveRef}
      />
    </div>
  );
}
