interface ConfidenceRingProps {
  value: number; // 0-100
  size?: number;
}

/**
 * Compact radial confidence indicator. Kept small and inline (in the page
 * header) rather than as its own full-width section, so the rest of the
 * viewport stays free for the graph and the explanation.
 */
export function ConfidenceRing({ value, size = 44 }: ConfidenceRingProps) {
  const stroke = 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  const color = value >= 80 ? 'var(--xai-teal)' : value >= 55 ? 'var(--xai-amber)' : 'var(--xai-clay)';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}% model confidence`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--xai-sand)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontFamily="Manrope, sans-serif" fontWeight={800} fontSize={size * 0.28} fill="var(--xai-ink)">
        {value}
      </text>
    </svg>
  );
}