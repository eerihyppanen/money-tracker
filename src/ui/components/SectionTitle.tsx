import type { ReactNode } from 'react';

export function SectionTitle({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {children && <p className="text-sm text-muted">{children}</p>}
    </div>
  );
}
