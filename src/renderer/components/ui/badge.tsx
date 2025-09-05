import * as React from 'react';

// Badge component used to display small status or category labels.  The
// badge is styled with a rounded border and subtle background colour.

export function Badge({ className = '', children }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-slate-50 text-slate-700 text-xs',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}