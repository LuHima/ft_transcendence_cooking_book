import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

export default function LoadingOverlay({
  recipesLoaded,
  sceneReady,
}: {
  recipesLoaded: boolean;
  sceneReady: boolean;
}) {
  const [displayProgress, setDisplayProgress] = useState(1);
  const [hidden, setHidden] = useState(false);
  const loadingComplete = recipesLoaded && sceneReady;

  useEffect(() => {
    let frame = 0;

    const animate = () => {
      setDisplayProgress((currentProgress) => {
        if (loadingComplete) {
          return Math.min(100, currentProgress + 2);
        }
        return Math.min(99, currentProgress + 0.35);
      });

      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [loadingComplete]);

  useEffect(() => {
    if (!loadingComplete || displayProgress < 100) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setHidden(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [displayProgress, loadingComplete]);

  if (hidden) {
    return null;
  }

  return (
    <div className="loader">
      <div className="loader-bar">
        <div style={{ width: `${displayProgress}%` }} />
      </div>
      <p>Caricamento... {Math.round(displayProgress)}%</p>
    </div>
  );
}

export function SceneReady({ onReady }: { onReady: () => void }) {
  const notified = useRef(false);

  useFrame(() => {
    if (notified.current) return;
    notified.current = true;
    onReady();
  });

  return null;
}
