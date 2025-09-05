import * as React from 'react';

// Button component used throughout the app.  It accepts a variant and size
// prop to control its appearance.  The default variant produces a dark
// primary button; secondary is a light variant; outline draws a subtle
// border; ghost has no border or background.
type Variant = 'default' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md';

export function Button(
  {
    variant = 'default',
    size = 'md',
    className = '',
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size },
): JSX.Element {
  const base = 'inline-flex items-center justify-center rounded-2xl transition-colors font-medium';
  const pad = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2';
  const style = {
    default: 'bg-slate-900 text-white hover:bg-slate-800',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    outline: 'border border-slate-300 text-slate-800 hover:bg-slate-50',
    ghost: 'text-slate-700 hover:bg-slate-100',
  }[variant];
  return (
    <button className={[base, pad, style, className].join(' ')} {...props} />
  );
}