import { useEffect } from "react";
import { Light, Mesh, OrthographicCamera, PerspectiveCamera } from "three";
import type { LightShadow, Object3D } from "three";

function hasShadow(light: Light): light is Light & { shadow: LightShadow } {
  return "shadow" in light;
}

export default function KitchenModel({
  scene,
  onClick,
}: {
  scene: Object3D;
  onClick: () => void;
}) {
  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
      if (object instanceof Light) {
        object.castShadow = true;
        if (hasShadow(object)) {
          object.shadow.mapSize.set(1024, 1024);
          const camera = object.shadow.camera;
          if (
            camera instanceof PerspectiveCamera ||
            camera instanceof OrthographicCamera
          ) {
            camera.near = 0.1;
            camera.far = 20;
          }
          object.shadow.bias = -0.001;
          object.shadow.normalBias = 0.02;
        }
      }
    });
  }, [scene]);

  return <primitive object={scene} dispose={null} onClick={onClick} />;
}
