import type { Group, SpotLight } from "three";

export function SceneLights({
  isBullseyeOn,
  sideLightRef,
  sideTargetRef,
}: {
  isBullseyeOn: boolean;
  sideLightRef: React.RefObject<SpotLight | null>;
  sideTargetRef: React.RefObject<Group | null>;
}) {
  return (
    <>
      <ambientLight intensity={0.2} color="#ffffff" />

      <pointLight
        position={[-1.85, 1.8, -0.65]}
        intensity={50}
        color="#4e310b"
        distance={4}
        decay={2}
      />
      <pointLight
        position={[-1.85, 1.8, 1.25]}
        intensity={50}
        color="#4e310b"
        distance={4}
        decay={2}
      />
      <pointLight
        position={[-1.85, 1.8, 3.2]}
        intensity={50}
        color="#4e310b"
        distance={4}
        decay={2}
      />

      {isBullseyeOn && (
        <spotLight
          ref={sideLightRef}
          position={[-2.283, 1.9, -0.065]}
          intensity={100}
          color="#4e310b"
          distance={3}
          angle={-Math.PI / 2}
          penumbra={0.3}
          decay={2}
          castShadow
        />
      )}

      <group ref={sideTargetRef} position={[-2.283, 1, -0.065]} />
    </>
  );
}
