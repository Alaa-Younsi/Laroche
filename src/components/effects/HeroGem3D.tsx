import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, Sparkles } from "@react-three/drei";
import type { Group } from "three";

const GOLD = "#D4AF37";

// Faceted brilliant-cut silhouette: two cones glued base-to-base (crown +
// deeper pavilion, per real diamond proportions) — reads unambiguously as
// a gemstone rather than an abstract crystal.
function DiamondGem({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.16, 0]}>
        <coneGeometry args={[0.34, 0.24, 8, 1]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.92}
          roughness={0.04}
          thickness={0.6}
          ior={2.42}
          clearcoat={1}
          clearcoatRoughness={0.02}
          attenuationColor="#fff8e6"
          attenuationDistance={0.4}
        />
      </mesh>
      <mesh position={[0, -0.18, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.34, 0.42, 8, 1]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.92}
          roughness={0.04}
          thickness={0.6}
          ior={2.42}
          clearcoat={1}
          clearcoatRoughness={0.02}
          attenuationColor="#fff8e6"
          attenuationDistance={0.4}
        />
      </mesh>
    </group>
  );
}

function AccentStone({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} scale={0.09}>
      <octahedronGeometry args={[1, 0]} />
      <meshPhysicalMaterial color="#ffffff" transmission={0.85} roughness={0.05} ior={2.2} clearcoat={1} />
    </mesh>
  );
}

function Ring() {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={groupRef} rotation={[0.55, 0, 0.12]}>
      {/* band */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.11, 32, 128]} />
        <meshPhysicalMaterial
          color={GOLD}
          metalness={0.92}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.08}
          envMapIntensity={1.6}
          reflectivity={1}
        />
      </mesh>

      {/* prong setting */}
      <mesh position={[0, 0.14, -1]}>
        <cylinderGeometry args={[0.22, 0.26, 0.16, 16]} />
        <meshPhysicalMaterial color={GOLD} metalness={0.92} roughness={0.18} envMapIntensity={1.6} />
      </mesh>

      {/* center stone */}
      <group position={[0, 0.34, -1]}>
        <DiamondGem scale={1.15} />
      </group>

      {/* small accent stones along the band */}
      <AccentStone position={[0.55, 0.06, -0.83]} />
      <AccentStone position={[-0.55, 0.06, -0.83]} />
    </group>
  );
}

// Procedural studio rig baked client-side (drei Lightformers), not a
// fetched HDRI — the metallic/transmissive materials need environment
// reflections to read as gold and cut glass at all, and a remote-preset
// Environment silently renders them near-invisible whenever that fetch
// fails (slow/offline connections, exactly what useMediaFlags gates for).
function StudioRig() {
  return (
    <Environment resolution={128}>
      <Lightformer form="rect" intensity={4} color="#fff6e0" position={[4, 4, 4]} scale={[4, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={2.5} color={GOLD} position={[-4, -1, 3]} scale={[3, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={3.5} color="#ffffff" position={[0, 3, -4]} scale={3} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={2} color="#ffffff" position={[3, -2, -3]} scale={[2, 2, 1]} target={[0, 0, 0]} />
    </Environment>
  );
}

export function HeroGem3D() {
  return (
    <Canvas
      camera={{ position: [0, 0.6, 4.2], fov: 38 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 4]} intensity={1.4} color="#fff6e0" />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color={GOLD} />
      <Suspense fallback={null}>
        <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.7}>
          <Ring />
        </Float>
        <StudioRig />
      </Suspense>
      <Sparkles count={70} scale={4.5} size={2.5} speed={0.35} opacity={0.75} color={GOLD} />
    </Canvas>
  );
}
