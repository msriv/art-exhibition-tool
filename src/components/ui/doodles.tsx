/**
 * Small hand-drawn-style SVG accents — purely decorative (`aria-hidden`),
 * used sparingly on public-facing pages to give the site a bit of an
 * artsy, sketched feel appropriate for a painting exhibition, without
 * touching the data-dense admin CRUD screens where they'd just be noise.
 *
 * Each path is intentionally a little irregular/wobbly (not a perfectly
 * smooth curve) to read as hand-drawn rather than a clean vector shape;
 * colored via `currentColor` so a wrapping `text-*` class controls it.
 */

export function DoodleUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 16"
      className={className}
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M3 10c18-9 32 7 50 1s28-10 46-2 30 9 48 1 28-9 44-1"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M4 12.5c18-7 33 5 51 0s27-8 45-1 29 8 47 1 27-7 43-0.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

/** A little asymmetric sparkle/star scribble, like a quick pen flourish. */
export function DoodleSparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <path
        d="M20 3c1 7 2 12 17 17-15 4-16 9-17 17-2-8-3-13-17-17 14-4 15-10 17-17Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A loose hand-drawn spiral/swirl accent. */
export function DoodleSwirl({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} fill="none" aria-hidden="true">
      <path
        d="M14 34c-3-9 4-18 14-18 9 0 15 7 13 15-2 7-9 10-14 7-4-3-5-8-2-11 2-3 6-3 8-1"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A single loose, slightly wobbly brush-stroke line — used as a section divider. */
export function DoodleStroke({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 10"
      className={className}
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M2 6c40-5 80 3 100-1s60-6 98-2 60 4 98-1"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
