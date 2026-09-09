import React from 'react';
import { motion } from 'framer-motion';
import useReducedMotion from '../../hooks/useReducedMotion';
import { useTheme } from '../../contexts/ThemeContext';

export default function AmbientGradient({ className = '' }) {
  const prefersReducedMotion = useReducedMotion();
  const { isDark } = useTheme();

  if (prefersReducedMotion) {
    return (
      <div className={`absolute inset-0 z-0 bg-surface ${className}`} />
    );
  }

  const lightGradients = [
    'radial-gradient(circle at 20% 30%, #dbe1ff 0%, transparent 50%)',
    'radial-gradient(circle at 80% 20%, #9df4c9 0%, transparent 50%)',
    'radial-gradient(circle at 50% 80%, #ffdbca 0%, transparent 50%)',
    'radial-gradient(circle at 20% 30%, #dbe1ff 0%, transparent 50%)',
  ];

  const darkGradients = [
    'radial-gradient(circle at 20% 30%, rgba(143, 149, 214, 0.14) 0%, transparent 50%)', /* lavender-300 */
    'radial-gradient(circle at 80% 20%, rgba(79, 190, 227, 0.12) 0%, transparent 50%)',  /* dark-teal-400 */
    'radial-gradient(circle at 50% 80%, rgba(99, 149, 156, 0.10) 0%, transparent 50%)',  /* dark-slate-grey-500 */
    'radial-gradient(circle at 20% 30%, rgba(143, 149, 214, 0.14) 0%, transparent 50%)',
  ];

  return (
    <div className={`absolute inset-0 z-0 overflow-hidden ${className}`}>
      <motion.div
        className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] opacity-40 blur-[100px] pointer-events-none"
        animate={{
          background: isDark ? darkGradients : lightGradients,
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
