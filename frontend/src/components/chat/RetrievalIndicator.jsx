import React from 'react';
import { motion } from 'framer-motion';
import Icon from '../common/Icon';

export default function RetrievalIndicator() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-4 text-body-sm text-on-surface-variant"
    >
      <div className="relative w-6 h-6 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="absolute inset-0 border-2 border-primary/20 border-t-primary rounded-full"
        />
        <Icon name="search" style={{ fontSize: '14px' }} className="text-primary" />
      </div>
      <span>Searching curriculum...</span>
    </motion.div>
  );
}
