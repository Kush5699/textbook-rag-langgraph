import React, { Component, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import useReducedMotion from '../../hooks/useReducedMotion';

class ThreeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('3D Hero Canvas Fallback active:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * 3D Open Gujarat State Board Textbook with simulated printed lines and holographic scanner beam
 */
function HolographicTextbook() {
  const group = useRef();
  const scannerRef = useRef();
  const glowPlaneRef = useRef();
  const { viewport, mouse } = useThree();
  const prefersReducedMotion = useReducedMotion();

  // Gentle mouse parallax and scanner laser sweep
  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (!prefersReducedMotion && group.current) {
      const targetRotationX = (mouse.y * viewport.height) / 25;
      const targetRotationY = (mouse.x * viewport.width) / 25;
      group.current.rotation.x += (targetRotationX - group.current.rotation.x) * 0.05;
      group.current.rotation.y += (targetRotationY - group.current.rotation.y) * 0.05;
    }

    // Move AI scanner beam up and down across the pages
    if (scannerRef.current) {
      const scanY = Math.sin(t * 1.8) * 1.15;
      scannerRef.current.position.y = scanY;
      if (glowPlaneRef.current) {
        glowPlaneRef.current.position.y = scanY;
      }
    }
  });

  // Materials
  const coverMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1c1f4a', // Lavender-800 deep hardcover
    roughness: 0.3,
    metalness: 0.2,
  }), []);

  const pageMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f8f9fd', // Crisp clean textbook paper
    roughness: 0.7,
    metalness: 0.05,
  }), []);

  const textLineMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#9aa0b8', // Subtle printed textbook text line
    transparent: true,
    opacity: 0.45,
  }), []);

  const headingLineMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#454fba', // Lavender-500 primary heading
    transparent: true,
    opacity: 0.75,
  }), []);

  const goldTrimMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#e5b869', // GSSTB official emblem gold accent
    roughness: 0.2,
    metalness: 0.8,
  }), []);

  return (
    <group ref={group}>
      <Float
        speed={prefersReducedMotion ? 0 : 2}
        rotationIntensity={prefersReducedMotion ? 0 : 0.3}
        floatIntensity={prefersReducedMotion ? 0 : 0.6}
      >
        {/* Central Book Spine */}
        <mesh position={[0, 0, -0.05]}>
          <cylinderGeometry args={[0.18, 0.18, 3.2, 16]} />
          <primitive object={coverMaterial} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <cylinderGeometry args={[0.04, 0.04, 3.22, 16]} />
          <primitive object={goldTrimMaterial} />
        </mesh>

        {/* LEFT BOOK WING (Cover + Page Stack) */}
        <group position={[-1.28, 0, 0]} rotation={[0, 0.24, 0]}>
          {/* Left Hardcover */}
          <mesh position={[0, 0, -0.06]}>
            <boxGeometry args={[2.5, 3.2, 0.08]} />
            <primitive object={coverMaterial} />
          </mesh>
          {/* Left Page Stack */}
          <mesh position={[0.04, 0, 0.02]}>
            <boxGeometry args={[2.4, 3.08, 0.08]} />
            <primitive object={pageMaterial} />
          </mesh>
          {/* Left Page Content Lines */}
          <group position={[0, 0, 0.07]}>
            {/* Header / Chapter title */}
            <mesh position={[-0.2, 1.15, 0]}>
              <planeGeometry args={[1.6, 0.09]} />
              <primitive object={headingLineMaterial} />
            </mesh>
            {/* Simulated paragraph lines */}
            {[-0.8, -0.55, -0.3, -0.05, 0.2, 0.45, 0.7, 0.9].map((y, idx) => (
              <mesh key={idx} position={[-0.1, y, 0]}>
                <planeGeometry args={[1.8 - (idx % 3) * 0.25, 0.035]} />
                <primitive object={textLineMaterial} />
              </mesh>
            ))}
          </group>
        </group>

        {/* RIGHT BOOK WING (Cover + Page Stack) */}
        <group position={[1.28, 0, 0]} rotation={[0, -0.24, 0]}>
          {/* Right Hardcover */}
          <mesh position={[0, 0, -0.06]}>
            <boxGeometry args={[2.5, 3.2, 0.08]} />
            <primitive object={coverMaterial} />
          </mesh>
          {/* Right Page Stack */}
          <mesh position={[-0.04, 0, 0.02]}>
            <boxGeometry args={[2.4, 3.08, 0.08]} />
            <primitive object={pageMaterial} />
          </mesh>
          {/* Right Page Content Lines */}
          <group position={[0, 0, 0.07]}>
            {/* Header / Formula box */}
            <mesh position={[0.2, 1.15, 0]}>
              <planeGeometry args={[1.6, 0.09]} />
              <primitive object={headingLineMaterial} />
            </mesh>
            {/* Simulated text lines */}
            {[-0.8, -0.55, -0.3, -0.05, 0.2, 0.45, 0.7, 0.9].map((y, idx) => (
              <mesh key={idx} position={[0.1, y, 0]}>
                <planeGeometry args={[1.8 - (idx % 2) * 0.3, 0.035]} />
                <primitive object={textLineMaterial} />
              </mesh>
            ))}
          </group>
        </group>

        {/* AI SCANNER BEAM (Sweeping Cyan/Lavender Laser) */}
        <group ref={scannerRef} position={[0, 0, 0.14]}>
          {/* Glowing laser core bar */}
          <mesh>
            <boxGeometry args={[5.0, 0.035, 0.035]} />
            <meshBasicMaterial color="#22aedd" />
          </mesh>
          {/* Ambient laser glow plane */}
          <mesh ref={glowPlaneRef} position={[0, 0, -0.01]}>
            <planeGeometry args={[5.0, 0.32]} />
            <meshBasicMaterial color="#4fbee3" transparent opacity={0.28} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* HOLOGRAPHIC FLOATING CITATION BADGES (Screen-space projection for crystal-clear sharp text) */}
        {/* Badge 1: Std 10 Mathematics */}
        <Html position={[-2.4, 1.45, 0.7]} center zIndexRange={[100, 0]}>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md border border-primary/50 shadow-xl text-xs font-semibold text-on-surface whitespace-nowrap select-none pointer-events-none antialiased">
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
            <span className="text-primary font-bold">📐 Std 10 Maths</span>
            <span className="text-on-surface-variant font-medium">• Ch. 12</span>
          </div>
        </Html>

        {/* Badge 2: Std 9 Science */}
        <Html position={[2.3, -1.35, 0.8]} center zIndexRange={[100, 0]}>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md border border-secondary/50 shadow-xl text-xs font-semibold text-on-surface whitespace-nowrap select-none pointer-events-none antialiased">
            <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0"></span>
            <span className="text-secondary font-bold">🔬 Std 9 Science</span>
            <span className="text-on-surface-variant font-medium">• Ch. 8</span>
          </div>
        </Html>

        {/* Badge 3: Verified RAG Citation */}
        <Html position={[2.0, 1.65, 0.4]} center zIndexRange={[100, 0]}>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-lowest/95 backdrop-blur-md border border-outline-variant/60 shadow-lg text-xs font-semibold text-on-surface whitespace-nowrap select-none pointer-events-none antialiased">
            <span className="text-emerald-500 font-bold text-sm">✓</span>
            <span className="font-semibold text-on-surface">GSEB Page-Accurate RAG</span>
          </div>
        </Html>
      </Float>
    </group>
  );
}

function VisualFallback() {
  return (
    <div className="w-full h-[420px] rounded-3xl bg-surface-container-lowest p-8 flex flex-col items-center justify-center text-center border border-outline-variant/40 shadow-lg relative overflow-hidden">
      <div className="w-20 h-20 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-5 shadow-sm">
        <span className="material-symbols-outlined text-4xl">school</span>
      </div>
      <h3 className="text-xl font-display text-on-surface font-bold">GSSTB Scholar RAG</h3>
      <p className="text-sm text-on-surface-variant max-w-xs mt-2">
        Official Gujarat State Board Digital Textbook AI Assistant
      </p>
      <div className="flex gap-2 mt-4">
        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">Std 9-12</span>
        <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-semibold">Verified Citations</span>
      </div>
    </div>
  );
}

export default function Hero3DScene() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <VisualFallback />;
  }

  return (
    <ThreeErrorBoundary fallback={<VisualFallback />}>
      <div className="w-full h-[520px]">
        <Canvas camera={{ position: [0, 0.4, 6.2], fov: 42 }} dpr={[1, 2]}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[6, 8, 6]} intensity={1.2} />
          <pointLight position={[-5, -2, 2]} intensity={0.6} color="#8f95d6" />
          <pointLight position={[5, 2, 3]} intensity={0.4} color="#4fbee3" />
          <HolographicTextbook />
        </Canvas>
      </div>
    </ThreeErrorBoundary>
  );
}

