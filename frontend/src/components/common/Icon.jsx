import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export default function Icon({ name, className, ...props }) {
  return (
    <span 
      className={twMerge('material-symbols-outlined', className)} 
      {...props}
      style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", ...props.style }}
    >
      {name}
    </span>
  );
}
