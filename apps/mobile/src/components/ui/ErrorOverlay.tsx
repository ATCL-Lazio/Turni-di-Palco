import React from 'react';

export type ErrorOverlayProps = {
  title: string;
  message: string;
  details?: string;
  onReload: () => void;
  onHome: () => void;
};

export function ErrorOverlay({ title, message, details, onReload, onHome }: ErrorOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-page px-6 py-10"
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
    >
      <section
        className="w-full max-w-[520px] rounded-[24px] border border-border bg-surface p-6 shadow-[0px_16px_40px_rgba(0,0,0,0.45)]"
        role="document"
      >
        <p className="text-[11px] uppercase tracking-[0.34em] text-fg-tertiary">Problema tecnico</p>
        <h1 className="mt-2 text-[26px] leading-[32px] font-semibold text-fg-primary">{title}</h1>
        <p className="mt-3 text-[15px] leading-[22px] text-fg-secondary">{message}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onReload}
            className="h-[44px] rounded-[16px] bg-gradient-to-b from-burgundy-bright to-burgundy-600 px-4 text-[16px] text-white"
          >
            Ricarica
          </button>
          <button
            type="button"
            onClick={onHome}
            className="h-[44px] rounded-[16px] border border-border px-4 text-[16px] text-accent"
          >
            Torna alla home
          </button>
        </div>
        {details ? (
          <details className="mt-4 text-[12px] text-fg-tertiary">
            <summary className="cursor-pointer">Dettagli tecnici</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-[12px] border border-border bg-[#141112] p-3 text-[12px] text-fg-secondary">
              {details}
            </pre>
          </details>
        ) : null}
      </section>
    </div>
  );
}
