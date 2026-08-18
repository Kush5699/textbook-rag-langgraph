import React, { Component, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
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

function PageStack() {
  const group = useRef();
  const { viewport, mouse } = useThree();
  const prefersReducedMotion = useReducedMotion();

  useFrame((state) => {
    if (!prefersReducedMotion && group.current) {
      group.current.rotation.y = state.clock.getElapsedTime() * 0.1;
      const targetRotationX = (mouse.y * viewport.height) / 15;
      const targetRotationY = (mouse.x * viewport.width) / 15;
      group.current.rotation.x += (targetRotationX - group.current.rotation.x) * 0.05;
      group.current.rotation.y += targetRotationY * 0.1;
    }
  });

  const material = new THREE.MeshPhysicalMaterial({
    color: '#003594',
    transmission: 0.8,
    opacity: 0.9,
    metalness: 0.1,
    roughness: 0.2,
    transparent: true,
    side: THREE.DoubleSide
  });

  return (
    <group ref={group}>
      <Float speed={prefersReducedMotion ? 0 : 2} rotationIntensity={prefersReducedMotion ? 0 : 0.5} floatIntensity={prefersReducedMotion ? 0 : 1}>
        {[...Array(8)].map((_, i) => (
          <mesh 
            key={i} 
            position={[0, (i - 4) * 0.25, 0]} 
            rotation={[Math.PI / 2, 0, (i * Math.PI) / 8]}
            material={material}
          >
            <boxGeometry args={[3.5, 2.5, 0.03]} />
          </mesh>
        ))}
      </Float>
    </group>
  );
}

function VisualFallback() {
  return (
    <div className="w-full h-[400px] rounded-3xl bg-gradient-to-br from-primary/10 via-surface-container to-secondary/10 flex flex-col items-center justify-center p-8 text-center border border-outline-variant/30 shadow-inner relative overflow-hidden">
      <div className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mb-4 animate-pulse">
        <span className="material-symbols-outlined text-5xl">school</span>
      </div>
      <h3 className="text-headline-sm font-display text-on-surface font-bold">GSSTB Scholar Workspace</h3>
      <p className="text-body-sm text-on-surface-variant max-w-xs mt-2">
        Official Gujarat State Board Textbook RAG Assistant
      </p>
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
      <div className="w-full h-[500px]">
        <Canvas camera={{ position: [0, 2, 8], fov: 45 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 10]} intensity={1} />
          <PageStack />
        </Canvas>
      </div>
    </ThreeErrorBoundary>
  );
}
