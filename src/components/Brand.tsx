/* ============================================================
   Benchmark Fox brand lockups — built from the real logo assets
   in public/brand (monogram cutouts + full stacked logo).
   ============================================================ */
import type { CSSProperties } from 'react';

type Variant = 'navy' | 'white';

// Resolve against Vite's base URL so assets work when hosted under a sub-path
// (e.g. GitHub Pages /benchmark-fox-readiness-portal/).
const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

/** Just the BF fox monogram. */
export function BrandMark({ variant = 'navy', size = 28 }: { variant?: Variant; size?: number }) {
  return (
    <img
      src={asset(`brand/mark-${variant}.png`)}
      alt="Benchmark Fox"
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  );
}

/** Monogram + “BENCHMARK FOX” wordmark, laid out horizontally (for app chrome). */
export function BrandLockup({
  variant = 'navy',
  size = 26,
  showTagline = false,
}: {
  variant?: Variant;
  size?: number;
  showTagline?: boolean;
}) {
  const word = variant === 'white' ? 'var(--navy-ink)' : 'var(--navy)';
  const foxColor = variant === 'white' ? 'rgba(243,246,251,.6)' : 'var(--silver)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
      <BrandMark variant={variant} size={size} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: 'var(--head)',
            fontWeight: 700,
            fontSize: size * 0.62,
            letterSpacing: '.04em',
            color: word,
          }}
        >
          BENCHMARK <span style={{ color: foxColor }}>FOX</span>
        </span>
        {showTagline && (
          <span
            style={{
              fontFamily: 'var(--body)',
              fontWeight: 600,
              fontSize: size * 0.3,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: variant === 'white' ? 'rgba(243,246,251,.55)' : 'var(--ink-faint)',
              marginTop: 3,
            }}
          >
            Readiness Portal
          </span>
        )}
      </div>
    </div>
  );
}

/** Full stacked logo image (monogram over wordmark) — for hero / login. */
export function BrandLogo({
  variant = 'navy',
  width = 220,
  style,
}: {
  variant?: Variant;
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <img
      src={asset(`brand/logo-${variant}.png`)}
      alt="Benchmark Fox"
      style={{ width, height: 'auto', display: 'block', ...style }}
    />
  );
}
