// src/components/Logo.js
'use client';
export default function Logo({ size = 36, style = {}, className = '' }) {
  return (
    <img
      src="/assets/images/OmniSensus_logo.svg"
      style={{ height: size * 1.5, width: 'auto', display: 'inline-block', objectFit: 'contain', ...style, }}
      className={className}
    />
  );
}
