import type { ReactNode } from 'react';

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      {children}
    </header>
  );
}
