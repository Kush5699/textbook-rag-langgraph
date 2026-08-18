import React from 'react';
import { motion } from 'framer-motion';
import useReducedMotion from '../../hooks/useReducedMotion';

export default function AmbientGradient({ className = '' }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className={`absolute inset-0 z-0 bg-surface ${className}`} />
    );
  }

  return (
    <div className={`absolute inset-0 z-0 overflow-hidden ${className}`}>
      <motion.div
        className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] opacity-40 blur-[100px] pointer-events-none"
        animate={{
          background: [
            'radial-gradient(circle at 20% 30%, #dbe1ff 0%, transparent 50%)',
            'radial-gradient(circle at 80% 20%, #9df4c9 0%, transparent 50%)',
            'radial-gradient(circle at 50% 80%, #ffdbca 0%, transparent 50%)',
            'radial-gradient(circle at 20% 30%, #dbe1ff 0%, transparent 50%)',
          ],
          x: ['-5%', '5%', '-2%', '-5%'],
          y: ['-5%', '2%', '5%', '-5%']
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
}
