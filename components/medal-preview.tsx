"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function Medal() {
  const geometry = new THREE.CylinderGeometry(1.2, 1.2, 0.18, 128);

  return (
    <group rotation={[0.35, -0.6, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#d4af37"
          metalness={1}
          roughness={0.22}
        />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.72, 0.08, 32, 256]} />
        <meshStandardMaterial
          color="#ffd76a"
          metalness={1}
          roughness={0.18}
        />
      </mesh>
    </group>
  );
}

export function MedalPreview() {
  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-black/10 bg-zinc-950 shadow-sm">
      <Canvas
        camera={{ position: [2.4, 1.5, 2.6], fov: 45 }}
        shadows
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#06070a"]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[3, 4, 2]}
          intensity={2.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-4, 2, -2]} intensity={0.9} />
        <Medal />
        <Environment preset="city" />
        <OrbitControls enablePan={false} minDistance={2} maxDistance={6} />
      </Canvas>
    </div>
  );
}

