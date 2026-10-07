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

async function fetchData(url: string): Promise<fetchedValues> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }

  return response.json();
}

function SceneContent({
  controlsRef,
  recipes,
  hasPreviousPage,
  hasNextPage,
  isChangingApiPage,
  onPreviousApiPage,
  onNextApiPage,
  currentApiPage,
}: SceneContentProps) {
  const { scene } = useGLTF(kitchenUrl);

  return (
    <>
      <KitchenModel scene={scene} />
      <Book
        controlsRef={controlsRef}
        recipes={recipes}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
        isChangingApiPage={isChangingApiPage}
        onPreviousApiPage={onPreviousApiPage}
        onNextApiPage={onNextApiPage}
        currentApiPage={currentApiPage}
      />
    </>
  );
}

export default function Scene() {
  const initialApiPage = 1;
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentApiPage, setCurrentApiPage] = useState(initialApiPage);
  const [isChangingApiPage, setIsChangingApiPage] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const pageRequestInProgress = useRef(false);
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
    fetchData(`/api/recipes/page?value=${initialApiPage}`)
      .then((loadedRecipes: fetchedValues) => {
        setRecipes(loadedRecipes.returnPage);
        setHasPreviousPage(loadedRecipes.hasPreviousPage);
        setHasNextPage(loadedRecipes.hasNextPage);
      })
      .catch((error) => {
        console.error("Failed to load recipes:", error);
        setPaginationError("Impossibile caricare le ricette.");
      })
      .finally(() => {
        setRecipesLoaded(true);
      });
  }, []);

  // Functions to handle API page changes
  // This function fetches the recipes for a given page and updates the state accordingly
  async function loadApiPage(page: number) {
    // Prevent multiple simultaneous requests
    if (pageRequestInProgress.current) return;
    // Set the request in progress flag and indicate that the API page is changing
    pageRequestInProgress.current = true;
    setIsChangingApiPage(true);

    // Fetch the recipes for the specified page
    try {
      const loadedRecipes = await fetchData(`/api/recipes/page?value=${page}`);
      setRecipes(loadedRecipes.returnPage);
      setHasPreviousPage(loadedRecipes.hasPreviousPage);
      setHasNextPage(loadedRecipes.hasNextPage);
      setCurrentApiPage(page);
      setPaginationError(null);
    } catch (error) {
      console.error("Failed to change recipe page:", error);
      setPaginationError("Impossibile caricare le ricette richieste.");
    } finally {
      pageRequestInProgress.current = false;
      setIsChangingApiPage(false);
    }
  }

  // Functions to navigate to the previous API page
  function goToPreviousApiPage() {
    if (hasPreviousPage && !isChangingApiPage) {
      void loadApiPage(currentApiPage - 1);
    }
  }

  // Functions to navigate to the next API page
  function goToNextApiPage() {
    if (hasNextPage && !isChangingApiPage) {
      void loadApiPage(currentApiPage + 1);
    }
  }

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
        role="switch"
        className={`absolute left-4 top-4 z-10 flex h-10 w-[4.5rem] items-center rounded-full border p-1 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 motion-reduce:transition-none ${isBullseyeOn ? "border-amber-200/70 bg-amber-100/15 shadow-amber-300/20" : "border-white/20 bg-black/40 shadow-black/30"}`}
      >
        <span
          aria-hidden="true"
          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-lg transition-all duration-500 ease-out motion-reduce:transition-none ${isBullseyeOn ? "translate-x-0 bg-amber-200 text-[#38220b] shadow-amber-300/40" : "translate-x-8 bg-stone-200 text-[#26303b] shadow-black/40"}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`absolute h-5 w-5 transition-all duration-300 ease-out motion-reduce:transition-none ${isBullseyeOn ? "rotate-0 scale-100 opacity-100" : "-rotate-45 scale-50 opacity-0"}`}
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="3.5" />
            <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`absolute h-5 w-5 transition-all duration-300 ease-out motion-reduce:transition-none ${isBullseyeOn ? "rotate-45 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" />
          </svg>
        </span>
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
        dpr={[1, 1.25]}
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
            <SceneContent
              controlsRef={controlsRef}
              recipes={recipes}
              hasPreviousPage={hasPreviousPage}
              hasNextPage={hasNextPage}
              isChangingApiPage={isChangingApiPage}
              onPreviousApiPage={goToPreviousApiPage}
              onNextApiPage={goToNextApiPage}
              currentApiPage={currentApiPage}
            />
            <SceneReady onReady={() => setSceneReady(true)} />
          </Suspense>
        )}
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
          maxAzimuthAngle={-Math.PI * 0.2}
        />
      </Canvas>
      {paginationError && (
        <div
          role="alert"
          className="pointer-events-none absolute right-4 top-16 z-10 rounded-md bg-red-950/90 px-4 py-2 text-sm text-red-100 shadow-lg"
        >
          {paginationError}
        </div>
      )}
      <LoadingOverlay
        recipesLoaded={recipesLoaded}
        sceneReady={sceneReady}
        progressRef={assetProgressRef}
        activeRef={assetsActiveRef}
      />
    </div>
  );
}
