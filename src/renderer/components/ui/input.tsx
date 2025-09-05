import * as React from 'react';

// Input component that wraps a native input element with a consistent
// Tailwind-based style.  It forwards all props to the underlying input.

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="h-9 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      {...props}
    />
  );
}