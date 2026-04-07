import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Ticket, Camera, X } from 'lucide-react';
import jsQR from 'jsqr';
import { GameEvent } from '../../state/store';

interface QRScannerProps {
  onClose: () => void;
  onScan: (code: string) => Promise<{ ok: true } | { ok: false; error: string }> | { ok: true } | { ok: false; error: string };
  events?: GameEvent[];
}

export function QRScanner({ onClose, onScan, events = [] }: QRScannerProps) {
  const [manualTicket, setManualTicket] = useState('');
  const [manualEventId, setManualEventId] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isHandlingScan, setIsHandlingScan] = useState(false);
  const [cameraSessionId, setCameraSessionId] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<number | null>(null);
  const hasHandledScanRef = useRef(false);
  const resumeScanRef = useRef<(() => void) | null>(null);
  const onScanRef = useRef(onScan);
  const isScanningRef = useRef(isScanning);

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { isScanningRef.current = isScanning; }, [isScanning]);

  const stopCamera = () => {
    if (scanTimeoutRef.current != null) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
    if (resumeTimeoutRef.current != null) { clearTimeout(resumeTimeoutRef.current); resumeTimeoutRef.current = null; }
    resumeScanRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleScanAttempt = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScanError(null);
    setIsHandlingScan(true);
    let shouldResume = true;
    try {
      const result = await onScanRef.current(trimmed);
      if (result.ok) { stopCamera(); shouldResume = false; return; }
      setScanError(result.error);
      if (isAuthErrorMessage(result.error)) { stopCamera(); shouldResume = false; }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Codice non valido.';
      setScanError(message);
      if (isAuthErrorMessage(message)) { stopCamera(); shouldResume = false; }
    } finally {
      if (!shouldResume) { setIsHandlingScan(false); }
      else {
        if (resumeTimeoutRef.current != null) { window.clearTimeout(resumeTimeoutRef.current); resumeTimeoutRef.current = null; }
        resumeTimeoutRef.current = window.setTimeout(() => {
          setIsHandlingScan(false);
          if (isScanningRef.current) { setScanError(null); hasHandledScanRef.current = false; resumeScanRef.current?.(); }
        }, 1200);
      }
    }
  };

  useEffect(() => {
    if (!isScanning) { stopCamera(); return undefined; }
    hasHandledScanRef.current = false;
    setCameraError(null);
    setIsStartingCamera(true);
    let cancelled = false;

    const startCameraAndScan = async () => {
      if (!window.isSecureContext) {
        setCameraError("La fotocamera richiede una connessione sicura (HTTPS). Apri questa pagina in https:// oppure usa localhost.");
        setIsStartingCamera(false); return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Fotocamera non supportata in questo browser/dispositivo.');
        setIsStartingCamera(false); return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error('Video element non disponibile.');
        video.srcObject = stream; video.muted = true;
        await video.play().catch(() => {});
        if (cancelled) return;
        setIsStartingCamera(false);

        const scanOnce = () => {
          if (cancelled || hasHandledScanRef.current) return;
          resumeScanRef.current = scanOnce;
          const currentVideo = videoRef.current;
          const canvas = canvasRef.current;
          if (!currentVideo || !canvas || currentVideo.readyState < 2) { scanTimeoutRef.current = window.setTimeout(scanOnce, 200); return; }
          const w = currentVideo.videoWidth, h = currentVideo.videoHeight;
          if (!w || !h) { scanTimeoutRef.current = window.setTimeout(scanOnce, 200); return; }
          const scale = Math.min(1, 640 / Math.max(w, h));
          const sw = Math.max(1, Math.round(w * scale)), sh = Math.max(1, Math.round(h * scale));
          canvas.width = sw; canvas.height = sh;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) { scanTimeoutRef.current = window.setTimeout(scanOnce, 200); return; }
          ctx.drawImage(currentVideo, 0, 0, sw, sh);
          const imageData = ctx.getImageData(0, 0, sw, sh);
          const result = jsQR(imageData.data, sw, sh, { inversionAttempts: 'attemptBoth' });
          if (result?.data) { hasHandledScanRef.current = true; void handleScanAttempt(result.data); return; }
          scanTimeoutRef.current = window.setTimeout(scanOnce, 200);
        };
        scanOnce();
      } catch (error) {
        if (cancelled) return;
        stopCamera();
        setCameraError(formatCameraError(error));
        setIsStartingCamera(false);
      }
    };

    startCameraAndScan();
    return () => { cancelled = true; stopCamera(); };
  }, [cameraSessionId, isScanning]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTicket.trim() || !manualEventId.trim()) { setScanError('Inserisci sia ID Evento che Numero Ticket.'); return; }
    await handleScanAttempt(`manual-ticket:${manualEventId}:${manualTicket}`);
  };

  return (
    <div className="fixed inset-0 app-gradient z-50 flex flex-col"
      style={{ '--qrscanner-header-bg': '#1a1617', '--qrscanner-header-hover-bg': '#241f20', '--qrscanner-accent': '#f4bf4f' } as React.CSSProperties}>
      <ScannerHeader onClose={onClose} isScanning={isScanning} />

      <div className="flex-1 relative overflow-hidden">
        {isScanning ? (
          <CameraView
            videoRef={videoRef}
            canvasRef={canvasRef}
            isStartingCamera={isStartingCamera}
            isHandlingScan={isHandlingScan}
            scanError={scanError}
            cameraError={cameraError}
            onRetryCamera={() => setCameraSessionId(v => v + 1)}
            onSwitchToManual={() => setIsScanning(false)}
          />
        ) : (
          <ManualEntryForm
            manualTicket={manualTicket}
            manualEventId={manualEventId}
            events={events}
            scanError={scanError}
            isHandlingScan={isHandlingScan}
            onTicketChange={setManualTicket}
            onEventChange={setManualEventId}
            onSubmit={handleManualSubmit}
            onSwitchToScanner={() => setIsScanning(true)}
          />
        )}
      </div>
    </div>
  );
}

// === Sub-components ===

function ScannerHeader({ onClose, isScanning }: { onClose: () => void; isScanning: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-[color:var(--qrscanner-header-bg)]">
      <h3 className="text-white">{isScanning ? 'Scansiona Biglietto' : 'Registra Biglietto'}</h3>
      <button onClick={onClose}
        className="flex items-center justify-center size-[44px] hover:bg-[color:var(--qrscanner-header-hover-bg)] rounded-lg transition-colors">
        <X className="text-[color:var(--qrscanner-accent)]" size={24} />
      </button>
    </div>
  );
}

function CameraView({ videoRef, canvasRef, isStartingCamera, isHandlingScan, scanError, cameraError, onRetryCamera, onSwitchToManual }: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isStartingCamera: boolean; isHandlingScan: boolean;
  scanError: string | null; cameraError: string | null;
  onRetryCamera: () => void; onSwitchToManual: () => void;
}) {
  return (
    <>
      <div className="absolute inset-0 bg-black">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline autoPlay muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1617]/60 to-[#0f0d0e]/80" />
        <ScanningFrame />
        {isStartingCamera && <Overlay text="Avvio fotocamera..." />}
        {isHandlingScan && <Overlay text="Verifica biglietto..." />}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0f0d0e] to-transparent p-6">
        <div className="app-content text-center">
          {scanError && (
            <>
              <p className="text-white mb-2">Biglietto non valido</p>
              <p className="text-sm text-[#b8b2b3] mb-6">{scanError}</p>
            </>
          )}
          {cameraError ? (
            <>
              <p className="text-white mb-2">Impossibile avviare la fotocamera</p>
              <p className="text-sm text-[#b8b2b3] mb-6">{cameraError}</p>
              <div className="flex flex-col items-center gap-3">
                <Button variant="primary" onClick={onRetryCamera} className="w-full max-w-xs">Riprova</Button>
                <ManualSwitchButton onClick={onSwitchToManual} />
              </div>
            </>
          ) : (
            <>
              <p className="text-white mb-2">Inquadra il codice sul tuo biglietto ATCL</p>
              <p className="text-sm text-[#b8b2b3] mb-6">Posiziona il codice al centro del riquadro</p>
              <ManualSwitchButton onClick={onSwitchToManual} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ScanningFrame() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative w-64 h-64">
        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#f4bf4f] rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#f4bf4f] rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#f4bf4f] rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#f4bf4f] rounded-br-lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-1 bg-[#f4bf4f] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function Overlay({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0f0d0e]/60">
      <p className="text-sm text-[#b8b2b3]">{text}</p>
    </div>
  );
}

function ManualSwitchButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-md px-2 py-[10px] text-[#f4bf4f] hover:text-[#e6a23c] transition-colors">
      <Ticket size={16} />
      Inserisci numero biglietto
    </button>
  );
}

function ManualEntryForm({ manualTicket, manualEventId, events, scanError, isHandlingScan, onTicketChange, onEventChange, onSubmit, onSwitchToScanner }: {
  manualTicket: string; manualEventId: string; events: GameEvent[];
  scanError: string | null; isHandlingScan: boolean;
  onTicketChange: (v: string) => void; onEventChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void; onSwitchToScanner: () => void;
}) {
  return (
    <div className="p-6 app-content h-full overflow-y-auto pb-20">
      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-[#241f20] rounded-full flex items-center justify-center mx-auto mb-4">
          <Ticket className="text-[#f4bf4f]" size={32} />
        </div>
        <h3 className="text-white mb-2">Attiva il tuo Biglietto</h3>
        <p className="text-sm text-[#b8b2b3]">Inserisci il numero di biglietto pre-registrato</p>
      </div>

      <div className="mb-6 text-center">
        <div className="inline-block px-3 py-1 bg-[#241f20] rounded-full text-[10px] text-[#f4bf4f] font-bold uppercase tracking-wider">
          Attivazione Biglietto
        </div>
      </div>

      {scanError && (
        <div className="mb-4 rounded-xl border border-[#d32f2f]/30 bg-[#d32f2f]/10 px-4 py-3 text-center">
          <p className="text-[#ff5252] text-xs">{scanError}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-[#7f797a] ml-1 uppercase font-bold tracking-wider">Seleziona Evento</label>
            <div className="relative">
              <select value={manualEventId} onChange={e => onEventChange(e.target.value)}
                className="w-full bg-[#1a1617] border border-[#2d2728] rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-[#f4bf4f] transition-colors">
                <option value="" disabled>Scegli l'evento...</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.date})</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#f4bf4f]">
                <X size={14} className="rotate-45" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-[#7f797a] ml-1 uppercase font-bold tracking-wider">Numero Biglietto</label>
            <Input type="text" placeholder="es. 12345" value={manualTicket} onChange={e => onTicketChange(e.target.value)} className="text-center" />
            <p className="text-[10px] text-[#7f797a] text-center px-2 italic">Il biglietto deve essere stato pre-registrato dalla biglietteria autorizzata</p>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={isHandlingScan}>
            {isHandlingScan ? 'Verifica in corso...' : 'Attiva biglietto'}
          </Button>
          <button type="button" onClick={onSwitchToScanner}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md py-[10px] text-[#f4bf4f] hover:text-[#e6a23c] transition-colors">
            <Camera size={16} />
            Usa la fotocamera
          </button>
        </div>
      </form>
    </div>
  );
}

// === Helpers ===

function isAuthErrorMessage(message: string) {
  return /invalid jwt|sessione scaduta|login richiesto|unauthorized|401/i.test(message);
}

function formatCameraError(error: unknown) {
  if (!(error instanceof Error)) return "Errore sconosciuto durante l'accesso alla fotocamera.";
  const name = (error as Error & { name?: string }).name;
  switch (name) {
    case 'NotAllowedError': case 'SecurityError':
      return 'Accesso alla fotocamera negato. Abilita i permessi della fotocamera nelle impostazioni del browser.';
    case 'NotFoundError': return 'Nessuna fotocamera trovata su questo dispositivo.';
    case 'NotReadableError': return "Impossibile leggere dalla fotocamera (potrebbe essere gia' in uso).";
    default: return error.message || "Errore durante l'accesso alla fotocamera.";
  }
}
