import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { QrCode, X } from 'lucide-react';
import jsQR from 'jsqr';
import { GameEvent } from '../../state/store';

interface QRScannerProps {
  onClose: () => void;
  onScan: (code: string) => Promise<{ ok: true } | { ok: false; error: string }> | { ok: true } | { ok: false; error: string };
  events?: GameEvent[];
}

export function QRScanner({ onClose, onScan, events = [] }: QRScannerProps) {
  const [manualCode, setManualCode] = useState('');
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

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  const isAuthErrorMessage = (message: string) =>
    /invalid jwt|sessione scaduta|login richiesto|unauthorized|401/i.test(message);

  const handleScanAttempt = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setScanError(null);
    setIsHandlingScan(true);
    let shouldResume = true;

    try {
      const result = await onScanRef.current(trimmed);
      if (result.ok) {
        stopCamera();
        shouldResume = false;
        return;
      }

      setScanError(result.error);
      if (isAuthErrorMessage(result.error)) {
        stopCamera();
        shouldResume = false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'QR non valido.';
      setScanError(message);
      if (isAuthErrorMessage(message)) {
        stopCamera();
        shouldResume = false;
      }
    } finally {
      if (!shouldResume) {
        setIsHandlingScan(false);
        return;
      }

      if (resumeTimeoutRef.current != null) {
        window.clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }

      resumeTimeoutRef.current = window.setTimeout(() => {
        setIsHandlingScan(false);
        if (isScanningRef.current) {
          setScanError(null);
          hasHandledScanRef.current = false;
          resumeScanRef.current?.();
        }
      }, 1200);
    }
  };

  const formatCameraError = (error: unknown) => {
    if (!(error instanceof Error)) {
      return "Errore sconosciuto durante l'accesso alla fotocamera.";
    }

    const domException = error as Error & { name?: string };
    switch (domException.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Accesso alla fotocamera negato. Abilita i permessi della fotocamera nelle impostazioni del browser.';
      case 'NotFoundError':
        return 'Nessuna fotocamera trovata su questo dispositivo.';
      case 'NotReadableError':
        return "Impossibile leggere dalla fotocamera (potrebbe essere gia' in uso).";
      default:
        return error.message || "Errore durante l'accesso alla fotocamera.";
    }
  };

  const stopCamera = () => {
    if (scanTimeoutRef.current != null) {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    if (resumeTimeoutRef.current != null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }

    resumeScanRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!isScanning) {
      stopCamera();
      return undefined;
    }

    hasHandledScanRef.current = false;
    setCameraError(null);
    setIsStartingCamera(true);

    let cancelled = false;

    const startCameraAndScan = async () => {
      if (!window.isSecureContext) {
        setCameraError(
          "La fotocamera richiede una connessione sicura (HTTPS). Apri questa pagina in https:// oppure usa localhost."
        );
        setIsStartingCamera(false);
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Fotocamera non supportata in questo browser/dispositivo.');
        setIsStartingCamera(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          throw new Error('Video element non disponibile.');
        }

        video.srcObject = stream;
        video.muted = true;
        await video.play().catch(() => {});

        if (cancelled) {
          return;
        }

        setIsStartingCamera(false);

        const scanOnce = () => {
          if (cancelled || hasHandledScanRef.current) return;

          resumeScanRef.current = scanOnce;

          const currentVideo = videoRef.current;
          const canvas = canvasRef.current;

          if (!currentVideo || !canvas || currentVideo.readyState < 2) {
            scanTimeoutRef.current = window.setTimeout(scanOnce, 200);
            return;
          }

          const width = currentVideo.videoWidth;
          const height = currentVideo.videoHeight;
          if (!width || !height) {
            scanTimeoutRef.current = window.setTimeout(scanOnce, 200);
            return;
          }

          const maxDimension = 640;
          const scale = Math.min(1, maxDimension / Math.max(width, height));
          const scaledWidth = Math.max(1, Math.round(width * scale));
          const scaledHeight = Math.max(1, Math.round(height * scale));

          canvas.width = scaledWidth;
          canvas.height = scaledHeight;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            scanTimeoutRef.current = window.setTimeout(scanOnce, 200);
            return;
          }

          ctx.drawImage(currentVideo, 0, 0, scaledWidth, scaledHeight);
          const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);

          const result = jsQR(imageData.data, scaledWidth, scaledHeight, {
            inversionAttempts: 'attemptBoth',
          }); 

          if (result?.data) {
            hasHandledScanRef.current = true;
            void handleScanAttempt(result.data);
            return;
          }

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

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraSessionId, isScanning]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualTicket.trim() || !manualEventId.trim()) {
      setScanError('Inserisci sia ID Evento che Numero Ticket.');
      return;
    }
    // Proviamo a costruire un payload finto o chiamiamo direttamente onScan 
    // col formato speciale che App.tsx capirÃ 
    await handleScanAttempt(`manual-ticket:${manualEventId}:${manualTicket}`);
  };

  return (
    <div className="fixed inset-0 app-gradient z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#1c1c1e]">      
        <h3 className="text-white">Scansiona QR</h3>
        <button
          onClick={onClose}
          className="flex items-center justify-center size-[44px] hover:bg-[#2c2c2e] rounded-lg transition-colors"
        >
          <X className="text-[#0a84ff]" size={24} />
        </button>
      </div>
      
      {/* Camera Preview Area */}
      <div className="flex-1 relative overflow-hidden">
        {isScanning ? (
          <>
            {/* Camera View */}
            <div className="absolute inset-0 bg-black">
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                playsInline
                autoPlay
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 bg-gradient-to-b from-[#1c1c1e]/60 to-[#000000]/80"></div>

              <div className="absolute inset-0 flex items-center justify-center">
                {/* Scanning Frame */}
                <div className="relative w-64 h-64">
                {/* Corner Brackets */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#0a84ff] rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#0a84ff] rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#0a84ff] rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#0a84ff] rounded-br-lg"></div>
                
                {/* Scanning Line Animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-1 bg-[#0a84ff] animate-pulse"></div>
                </div>
                
                </div>
              </div>

              {isStartingCamera && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#000000]/60">
                  <p className="text-sm text-[#aeaeb2]">Avvio fotocamera...</p>
                </div>
              )}

              {isHandlingScan && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#000000]/60">
                  <p className="text-sm text-[#aeaeb2]">Verifica QR...</p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#000000] to-transparent p-6">
              <div className="app-content text-center">
                {scanError ? (
                  <>
                    <p className="text-white mb-2">QR non valido</p>
                    <p className="text-sm text-[#aeaeb2] mb-6">{scanError}</p>
                  </>
                ) : null}

                {cameraError ? (
                  <>
                    <p className="text-white mb-2">Impossibile avviare la fotocamera</p>
                    <p className="text-sm text-[#aeaeb2] mb-6">{cameraError}</p>

                    <div className="flex flex-col items-center gap-3">
                      <Button
                        variant="primary"
                        onClick={() => setCameraSessionId((value) => value + 1)}
                        className="w-full max-w-xs"
                      >
                        Riprova
                      </Button>

                      <button
                        onClick={() => setIsScanning(false)}
                        className="inline-flex items-center justify-center rounded-md px-2 py-[10px] text-[#0a84ff] hover:text-[#0066d6] transition-colors"
                      >
                        Inserisci codice manualmente
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-white mb-2">Inquadra il QR sul tuo biglietto ATCL</p>
                    <p className="text-sm text-[#aeaeb2] mb-6">
                      Posiziona il codice al centro del riquadro
                    </p>

                    <button
                      onClick={() => setIsScanning(false)}
                      className="inline-flex items-center justify-center rounded-md px-2 py-[10px] text-[#0a84ff] hover:text-[#0066d6] transition-colors"
                    >
                      Inserisci codice manualmente
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          // Manual Input
          <div className="p-6 app-content h-full overflow-y-auto pb-20">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-[#2c2c2e] rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="text-[#0a84ff]" size={32} />
              </div>
              <h3 className="text-white mb-2">Inserimento Manuale</h3>
              <p className="text-sm text-[#aeaeb2]">
                Inserisci i dati se il QR non Ã¨ leggibile
              </p>
            </div>

            {/* Manual Activation Header */}
            <div className="mb-6 text-center">
               <div className="inline-block px-3 py-1 bg-[#2c2c2e] rounded-full text-[10px] text-[#0a84ff] font-bold uppercase tracking-wider">
                 Attivazione Biglietto
               </div>
            </div>

            {scanError ? (
              <div className="mb-4 rounded-xl border border-[#d32f2f]/30 bg-[#d32f2f]/10 px-4 py-3 text-center">
                <p className="text-[#ff5252] text-xs">{scanError}</p>
              </div>
            ) : null}

            <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-[#7f797a] ml-1 uppercase font-bold tracking-wider">Seleziona Evento</label>
                    <div className="relative">
                      <select
                        value={manualEventId}
                        onChange={(e) => setManualEventId(e.target.value)}
                        className="w-full bg-[#1c1c1e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-[#0a84ff] transition-colors"
                      >
                        <option value="" disabled>Scegli l'evento...</option>
                        {events.map(event => (
                          <option key={event.id} value={event.id}>
                            {event.name} ({event.date})
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#0a84ff]">
                        <X size={14} className="rotate-45" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-[#7f797a] ml-1 uppercase font-bold tracking-wider">Numero Biglietto</label>
                    <Input
                      type="text"
                      placeholder="es. 12345"
                      value={manualTicket}
                      onChange={(e) => setManualTicket(e.target.value)}
                      className="text-center"
                    />
                    <p className="text-[10px] text-[#7f797a] text-center px-2 italic">
                      Puoi anche incollare direttamente l'Hash se lo hai
                    </p>
                  </div>
                </div>
              
              <div className="pt-4 space-y-3">
                <Button type="submit" variant="primary" size="lg" fullWidth disabled={isHandlingScan}>
                  {isHandlingScan ? 'Verifica in corso...' : 'Conferma dati'}
                </Button>
                
                <button
                  type="button"
                  onClick={() => setIsScanning(true)}
                  className="w-full rounded-md py-[10px] text-[#0a84ff] hover:text-[#0066d6] transition-colors"
                >
                  Torna alla scansione QR
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

