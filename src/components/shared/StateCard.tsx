import type { ReactNode } from "react";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`type-label inline-flex items-center gap-3 text-ink-accent ${className}`}>
      <span aria-hidden className="h-px w-6 bg-marigold" />
      {children}
    </span>
  );
}

/** Full-page centred message: loading, signed out, access denied. */
export default function StateCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-canvas">
      <div className="flex h-16 items-center justify-center border-b border-rule-hairline">
        <img src="/logo.png" alt="Musica Lumina" className="h-6 w-auto" />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md border border-rule-hairline border-t-2 border-t-marigold bg-surface-elevated p-8 text-center sm:p-10">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-4 text-[1.75rem]">{title}</h1>
          <div className="mt-3 text-[0.9375rem] text-ink-muted">{children}</div>
        </div>
      </main>
    </div>
  );
}
