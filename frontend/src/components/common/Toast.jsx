import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';

export default function Toast({ message, type = 'info', isVisible, onClose }) {
  const typeStyles = {
    success: 'bg-secondary-container text-on-secondary-container border-secondary',
    error: 'bg-error-container text-on-error-container border-error',
    info: 'bg-surface-container-high text-on-surface border-primary',
  };

  const icons = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${typeStyles[type]} z-50 min-w-[300px]`}
        >
          <Icon name={icons[type]} />
          <span className="text-body-sm flex-1">{message}</span>
          <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity">
            <Icon name="close" style={{ fontSize: '20px' }} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
