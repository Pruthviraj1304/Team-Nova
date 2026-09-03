export function MineLogo({ size = 24, color = "var(--dash-bg)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <polygon
        points="20,3 34,11.3 34,28.7 20,37 6,28.7 6,11.3"
        stroke={color}
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      <path
        d="M11,26 L16,15 L20,22 L24,14 L29,26"
        fill="none"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="14" r="1.9" fill={color} />
      <circle cx="24" cy="14" r="4.4" stroke={color} strokeWidth="1.2" opacity="0.4" />
    </svg>
  );
}
