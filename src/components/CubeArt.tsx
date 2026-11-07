/** Isometric cube mark used on product cards. Pure SVG, no external imagery. */
export function CubeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cube-top" x1="30" y1="20" x2="130" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bcd4ff" />
          <stop offset="1" stopColor="#7fb8ff" />
        </linearGradient>
        <linearGradient id="cube-left" x1="20" y1="70" x2="80" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b7bd6" />
          <stop offset="1" stopColor="#1c4fa0" />
        </linearGradient>
        <linearGradient id="cube-right" x1="140" y1="70" x2="80" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00a3ff" />
          <stop offset="1" stopColor="#0a63c9" />
        </linearGradient>
        <radialGradient id="cube-glow" cx="80" cy="80" r="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00a3ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#00a3ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="84" r="78" fill="url(#cube-glow)" />
      <path d="M80 38 132 66v50L80 144 28 116V66z" fill="url(#cube-left)" opacity="0.35" />
      <path d="M28 66 80 94v50L28 116z" fill="url(#cube-left)" />
      <path d="M132 66 80 94v50l52-28z" fill="url(#cube-right)" />
      <path d="M80 38 132 66 80 94 28 66z" fill="url(#cube-top)" />
      <path d="M80 52c-13 0-24 5-24 11s11 11 24 11 24-5 24-11-11-11-24-11z" fill="#ffffff" opacity="0.55" />
      <path d="M70 62c3-3 8-4 12-3 4 1 7 4 6 6-3-2-8-3-12-2-2 1-4 1-6-1z" fill="#ffffff" opacity="0.8" />
    </svg>
  )
}
