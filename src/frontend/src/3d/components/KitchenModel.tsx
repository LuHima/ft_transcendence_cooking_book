import { useEffect } from "react";
import type { Object3D } from "three";

export default function KitchenModel({ scene }: { scene: Object3D }) {
  useEffect(() => {
    scene.traverse((c: any) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
      if (c.isLight) {
        c.castShadow = true;
        if (c.shadow) {
          c.shadow.mapSize.set(1024, 1024);
          c.shadow.camera.near = 0.1;
          c.shadow.camera.far = 20;
          c.shadow.bias = -0.001;
          c.shadow.normalBias = 0.02;
        }
      }
    });
  }, [scene]);

  return <primitive object={scene} dispose={null} />;
}
