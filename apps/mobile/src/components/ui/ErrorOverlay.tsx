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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#000000] px-6 py-10"
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
    >
      <section
        className="w-full max-w-[520px] rounded-[24px] border border-[#3a3a3c] bg-[#1c1c1e] p-6 shadow-[0px_16px_40px_rgba(0,0,0,0.45)]"
        role="document"
      >
        <p className="text-[11px] uppercase tracking-[0.34em] text-[#8e8e93]">Problema tecnico</p>
        <h1 className="mt-2 text-[26px] leading-[32px] font-semibold text-[#f2f2f7]">{title}</h1>
        <p className="mt-3 text-[15px] leading-[22px] text-[#aeaeb2]">{message}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onReload}
            className="h-[44px] rounded-[16px] bg-gradient-to-b from-[#0066d6] to-[#0a84ff] px-4 text-[16px] text-white"
          >
            Ricarica
          </button>
          <button
            type="button"
            onClick={onHome}
            className="h-[44px] rounded-[16px] border border-[#3a3a3c] px-4 text-[16px] text-[#0a84ff]"
          >
            Torna alla home
          </button>
        </div>
        {details ? (
          <details className="mt-4 text-[12px] text-[#8e8e93]">
            <summary className="cursor-pointer">Dettagli tecnici</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-[12px] border border-[#3a3a3c] bg-[#141112] p-3 text-[12px] text-[#aeaeb2]">
              {details}
            </pre>
          </details>
        ) : null}
      </section>
    </div>
  );
}

