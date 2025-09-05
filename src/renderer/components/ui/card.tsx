import * as React from 'react';

// Simple card and card content components.  These wrap the children with
// rounded corners, a border and optional shadow.  Use them to group
// related content in the UI.

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={['rounded-2xl border border-slate-200 bg-white shadow-sm', props.className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={['p-4', props.className].filter(Boolean).join(' ')}
    />
  );
}