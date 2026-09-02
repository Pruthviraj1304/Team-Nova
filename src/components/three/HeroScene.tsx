import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles, Float, MeshDistortMaterial } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

const PALETTE = {
  amber: "#f5a623",
  cyan: "#22d3ee",
  bg: "#05070c",
};

function useReducedMotion() {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
}

function OrbitNode({ radius, speed, offset, color, axis = "z" }: { radius: number; speed: number; offset: number; color: string; axis?: "x" | "y" | "z" }) {
  const ref = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (reduced ? 0 : clock.getElapsedTime()) * speed + offset;
    if (axis === "z") {
      ref.current.position.set(Math.cos(t) * radius, Math.sin(t) * radius, 0);
    } else if (axis === "x") {
      ref.current.position.set(0, Math.sin(t) * radius, Math.cos(t) * radius);
    } else {
      ref.current.position.set(Math.sin(t) * radius, 0, Math.cos(t) * radius);
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.07, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} toneMapped={false} />
    </mesh>
  );
}

function Rings() {
  const g1 = useRef<THREE.Group>(null);
  const g2 = useRef<THREE.Group>(null);
  const g3 = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();

  useFrame((_, delta) => {
    if (reduced) return;
    if (g1.current) g1.current.rotation.x += delta * 0.18;
    if (g2.current) g2.current.rotation.y += delta * 0.14;
    if (g3.current) g3.current.rotation.z += delta * 0.11;
  });

  return (
    <>
      <group ref={g1} rotation={[0.6, 0.3, 0]}>
        <mesh>
          <torusGeometry args={[1.65, 0.012, 16, 120]} />
          <meshStandardMaterial color={PALETTE.cyan} emissive={PALETTE.cyan} emissiveIntensity={1.2} toneMapped={false} transparent opacity={0.55} />
        </mesh>
      </group>
      <group ref={g2} rotation={[1.1, 0, 0.4]}>
        <mesh>
          <torusGeometry args={[1.95, 0.008, 16, 120]} />
          <meshStandardMaterial color={PALETTE.amber} emissive={PALETTE.amber} emissiveIntensity={1} toneMapped={false} transparent opacity={0.4} />
        </mesh>
      </group>
      <group ref={g3} rotation={[0.2, 1.2, 0.9]}>
        <mesh>
          <torusGeometry args={[1.4, 0.01, 16, 120]} />
          <meshStandardMaterial color={PALETTE.cyan} emissive={PALETTE.cyan} emissiveIntensity={0.9} toneMapped={false} transparent opacity={0.35} />
        </mesh>
      </group>
    </>
  );
}

function Core() {
  const coreRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();

  useFrame((_, delta) => {
    if (reduced) return;
    if (coreRef.current) coreRef.current.rotation.y += delta * 0.22;
    if (wireRef.current) {
      wireRef.current.rotation.y -= delta * 0.12;
      wireRef.current.rotation.x += delta * 0.06;
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 2]} />
        <MeshDistortMaterial
          color={PALETTE.amber}
          emissive={PALETTE.amber}
          emissiveIntensity={0.55}
          roughness={0.25}
          metalness={0.4}
          distort={0.28}
          speed={reduced ? 0 : 1.6}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={wireRef} scale={1.32}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={PALETTE.cyan} wireframe transparent opacity={0.28} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene() {
  const reduced = useReducedMotion();

  return (
    <>
      <color attach="background" args={[PALETTE.bg]} />
      <fog attach="fog" args={[PALETTE.bg, 4.5, 9.5]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[3.2, 2.4, 2.6]} intensity={26} color={PALETTE.amber} />
      <pointLight position={[-3.4, -1.8, -2]} intensity={18} color={PALETTE.cyan} />
      <directionalLight position={[0, 4, 5]} intensity={0.4} color="#ffffff" />

      <Float speed={reduced ? 0 : 1.4} rotationIntensity={reduced ? 0 : 0.35} floatIntensity={reduced ? 0 : 0.9}>
        <Core />
        <Rings />
        <OrbitNode radius={1.65} speed={0.5} offset={0} color={PALETTE.cyan} axis="z" />
        <OrbitNode radius={1.95} speed={0.35} offset={2.1} color={PALETTE.amber} axis="x" />
        <OrbitNode radius={1.4} speed={0.6} offset={4.2} color={PALETTE.cyan} axis="y" />
      </Float>

      <Sparkles count={70} scale={7} size={2.2} speed={reduced ? 0 : 0.25} color={PALETTE.amber} opacity={0.5} />
      <Sparkles count={50} scale={5.5} size={1.6} speed={reduced ? 0 : 0.2} color={PALETTE.cyan} opacity={0.4} />
    </>
  );
}

export function HeroScene({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 0.3, 5.2], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
