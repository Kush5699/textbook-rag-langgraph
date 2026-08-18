import React from 'react';
import { motion } from 'framer-motion';
import useReducedMotion from '../../hooks/useReducedMotion';

export default function WordReveal({ text, className = '' }) {
  const prefersReducedMotion = useReducedMotion();
  const words = text.split(' ');

  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.04 * i },
    }),
  };

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 100,
      },
    },
    hidden: {
      opacity: 0,
      y: 20,
      filter: 'blur(10px)',
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 100,
      },
    },
  };

  if (prefersReducedMotion) {
    return <div className={className}>{text}</div>;
  }

  return (
    <motion.div
      className={`flex flex-wrap ${className}`}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {words.map((word, index) => (
        <motion.span variants={child} key={index} className="mr-2 mb-2">
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
}
