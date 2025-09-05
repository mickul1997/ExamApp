import * as React from 'react';

// Progress bar component.  Displays a horizontal bar with a filled portion
// corresponding to the value prop (0–100).  The bar has a rounded track
// and the filled part uses the dark primary colour.

export function Progress({ value = 0, className = '' }: { value?: number; className?: string }) {
  // Clamp the value between 0 and 100.
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={[
      'h-2 w-full rounded-full bg-slate-200 overflow-hidden',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    >
      <div
        className="h-full bg-slate-900"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}