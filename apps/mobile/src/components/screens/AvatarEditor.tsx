import React, { useRef, useState } from 'react';
import { ArrowLeft, Link2, Loader2, Save } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import '@google/model-viewer';

type SaveStatus = { type: 'idle' | 'error' | 'success'; message?: string };

interface AvatarEditorProps {
  avatarGlbUrl?: string | null;
  avatarThumbUrl?: string | null;
  onBack: () => void;
  onSaved: (payload: { glbUrl: string; thumbUrl: string | null; updatedAt: string }) => void;
}

type ModelViewerElement = HTMLElement & {
  toDataURL: (type?: string, encoderOptions?: number) => string;
};

export function AvatarEditor({
  avatarGlbUrl,
  avatarThumbUrl,
  onBack,
  onSaved,
}: AvatarEditorProps) {
  const [glbUrl, setGlbUrl] = useState(avatarGlbUrl ?? '');
  const [previewUrl, setPreviewUrl] = useState(avatarGlbUrl ?? '');
  const [status, setStatus] = useState<SaveStatus>({ type: 'idle' });
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);

  const handlePaste = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      setStatus({ type: 'error', message: 'Clipboard non disponibile' });
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      setGlbUrl(text.trim());
      setStatus({ type: 'idle' });
    } catch {
      setStatus({ type: 'error', message: 'Impossibile leggere dagli appunti' });
    }
  };

  const handlePreview = async () => {
    const trimmed = glbUrl.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: 'Inserisci un URL .glb valido' });
      return;
    }
    if (!trimmed.toLowerCase().endsWith('.glb')) {
      if (!isSupabaseConfigured || !supabase) {
        setStatus({ type: 'error', message: 'Supabase non configurato' });
        return;
      }
      setIsResolving(true);
      setIsPreviewLoading(true);
      setIsModelReady(false);
      setStatus({ type: 'idle' });
      const { data, error } = await supabase.functions.invoke('import-avatar', {
        body: { sourceUrl: trimmed, resolveOnly: true },
      });
      setIsResolving(false);
      if (error) {
        setIsPreviewLoading(false);
        setStatus({ type: 'error', message: error.message || 'Impossibile risolvere il link' });
        return;
      }
      const resolvedUrl = data?.resolvedGlbUrl;
      if (!resolvedUrl || typeof resolvedUrl !== 'string') {
        setIsPreviewLoading(false);
        setStatus({ type: 'error', message: 'Link .glb non trovato' });
        return;
      }
      setGlbUrl(resolvedUrl);
      setPreviewUrl(resolvedUrl);
      return;
    }
    setPreviewUrl(trimmed);
    setIsPreviewLoading(true);
    setIsModelReady(false);
    setStatus({ type: 'idle' });
  };

  const handleSave = async () => {
    const trimmed = glbUrl.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: 'Inserisci un URL .glb valido' });
      return;
    }
    if (!trimmed.toLowerCase().endsWith('.glb')) {
      setStatus({
        type: 'error',
        message: 'Usa "Anteprima modello" per risolvere il link embed',
      });
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setStatus({ type: 'error', message: 'Supabase non configurato' });
      return;
    }
    if (!isModelReady || !modelViewerRef.current) {
      setStatus({ type: 'error', message: 'Anteprima non pronta. Carica il modello.' });
      return;
    }

    let thumbnailDataUrl: string;
    try {
      thumbnailDataUrl = modelViewerRef.current.toDataURL('image/png');
    } catch {
      setStatus({ type: 'error', message: 'Impossibile generare la thumbnail' });
      return;
    }

    setIsSaving(true);
    setStatus({ type: 'idle' });

    const { data, error } = await supabase.functions.invoke('import-avatar', {
      body: { glbUrl: trimmed, thumbnailDataUrl },
    });

    setIsSaving(false);

    if (error) {
      setStatus({ type: 'error', message: error.message || 'Salvataggio fallito' });
      return;
    }

    const glbUrlResult = data?.avatarGlbUrl ?? trimmed;
    const thumbUrlResult = data?.avatarThumbUrl ?? avatarThumbUrl ?? null;
    const updatedAt = data?.avatarUpdatedAt ?? new Date().toISOString();

    onSaved({ glbUrl: glbUrlResult, thumbUrl: thumbUrlResult, updatedAt });
    setStatus({ type: 'success', message: 'Avatar aggiornato' });
  };

  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full max-w-[393px] flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-6 box-border"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center justify-center size-[44px] text-[#f4bf4f]"
        aria-label="Indietro"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="flex flex-col gap-2">
        <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f5f5f5]">
          Avatar
        </p>
        <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">
          Incolla il link .glb o embed: l'anteprima lo risolve e genera la miniatura.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-[14px] leading-[20px] text-[#b8b2b3]">URL .glb</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[#241f20] border-2 border-[#2d2728] rounded-[10px] flex h-[44px] items-center overflow-clip transition-colors focus-within:border-[#f4bf4f]">
            <input
              type="url"
              value={glbUrl}
              onChange={(event) => setGlbUrl(event.target.value)}
              placeholder="https://.../avatar.glb"
              className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handlePaste}
            className="h-[44px] px-[14px] rounded-[12px] bg-[#1a1617] text-[#f4bf4f] text-[14px] leading-[20px] border border-[#2d2728]"
          >
            Incolla
          </button>
        </div>
        <button
          type="button"
          onClick={handlePreview}
          className="h-[44px] rounded-[14px] bg-gradient-to-b from-[#2d0a0f] to-[#1a1617] text-[#f4bf4f] flex items-center justify-center gap-2"
          disabled={isResolving}
        >
          {isResolving ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
          {isResolving ? 'Risoluzione link...' : 'Anteprima modello'}
        </button>
      </div>

      <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[18px] leading-[25.2px] font-semibold text-white">Anteprima</p>
          {isPreviewLoading ? (
            <span className="text-[12px] leading-[16px] text-[#b8b2b3] flex items-center gap-1">
              <Loader2 size={14} className="animate-spin" />
              Caricamento
            </span>
          ) : null}
        </div>
        {previewUrl ? (
          <div className="rounded-[14px] overflow-hidden bg-[#0f0d0e] border border-[#2d2728]">
            <model-viewer
              ref={modelViewerRef as React.RefObject<HTMLElement>}
              src={previewUrl}
              poster={avatarThumbUrl ?? undefined}
              camera-controls
              auto-rotate
              shadow-intensity="0.7"
              style={{ width: '100%', height: '320px' }}
              onLoad={() => {
                setIsPreviewLoading(false);
                setIsModelReady(true);
              }}
              onError={() => {
                setIsPreviewLoading(false);
                setIsModelReady(false);
                setStatus({ type: 'error', message: 'Impossibile caricare il modello' });
              }}
            />
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-[#2d2728] px-4 py-10 text-center text-[14px] leading-[20px] text-[#7a7577]">
            Nessuna anteprima disponibile
          </div>
        )}
        <p className="text-[12px] leading-[18px] text-[#7a7577]">
          Ruota e zooma il modello. La miniatura viene generata da questa vista.
        </p>
      </div>

      {status.type !== 'idle' ? (
        <p
          className={`text-[14px] leading-[20px] ${
            status.type === 'error' ? 'text-[#ff4d4f]' : 'text-[#7ad176]'
          }`}
        >
          {status.message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="bg-gradient-to-b from-[#8c1c38] to-[#a82847] h-[44px] w-full rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Salvataggio...
          </>
        ) : (
          <>
            <Save size={18} />
            Salva avatar
          </>
        )}
      </button>
    </Screen>
  );
}
