import React from 'react';
import { motion } from 'framer-motion';

export default function StreamingCursor() {
  return (
    <motion.span
      className="inline-block w-[2px] h-[1em] bg-primary ml-1 align-middle"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
  );
}
