import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { QrCode, X } from 'lucide-react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onClose: () => void;
  onScan: (code: string) => Promise<{ ok: true } | { ok: false; error: string }> | { ok: true } | { ok: false; error: string };
}

export function QRScanner({ onClose, onScan }: QRScannerProps) {
  const [manualCode, setManualCode] = useState('');
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
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'QR non valido.');
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
    if (!manualCode.trim()) return;
    await handleScanAttempt(manualCode);
  };

  return (
    <div className="fixed inset-0 app-gradient z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#1a1617]">      
        <h3 className="text-white">Scansiona QR</h3>
        <button
          onClick={onClose}
          className="flex items-center justify-center size-[44px] hover:bg-[#241f20] rounded-lg transition-colors"
        >
          <X className="text-[#f4bf4f]" size={24} />
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
              <div className="absolute inset-0 bg-gradient-to-b from-[#1a1617]/60 to-[#0f0d0e]/80"></div>

              <div className="absolute inset-0 flex items-center justify-center">
                {/* Scanning Frame */}
                <div className="relative w-64 h-64">
                {/* Corner Brackets */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#f4bf4f] rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#f4bf4f] rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#f4bf4f] rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#f4bf4f] rounded-br-lg"></div>
                
                {/* Scanning Line Animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-1 bg-[#f4bf4f] animate-pulse"></div>
                </div>
                
                </div>
              </div>

              {isStartingCamera && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0f0d0e]/60">
                  <p className="text-sm text-[#b8b2b3]">Avvio fotocamera...</p>
                </div>
              )}

              {isHandlingScan && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0f0d0e]/60">
                  <p className="text-sm text-[#b8b2b3]">Verifica QR...</p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0f0d0e] to-transparent p-6">
              <div className="max-w-md mx-auto text-center">
                {scanError ? (
                  <>
                    <p className="text-white mb-2">QR non valido</p>
                    <p className="text-sm text-[#b8b2b3] mb-6">{scanError}</p>
                  </>
                ) : null}

                {cameraError ? (
                  <>
                    <p className="text-white mb-2">Impossibile avviare la fotocamera</p>
                    <p className="text-sm text-[#b8b2b3] mb-6">{cameraError}</p>

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
                        className="inline-flex items-center justify-center rounded-md px-2 py-[10px] text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
                      >
                        Inserisci codice manualmente
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-white mb-2">Inquadra il QR sul tuo biglietto ATCL</p>
                    <p className="text-sm text-[#b8b2b3] mb-6">
                      Posiziona il codice al centro del riquadro
                    </p>

                    <button
                      onClick={() => setIsScanning(false)}
                      className="inline-flex items-center justify-center rounded-md px-2 py-[10px] text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
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
          <div className="p-6 max-w-md mx-auto">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-[#241f20] rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="text-[#f4bf4f]" size={32} />
              </div>
              <h3 className="text-white mb-2">Inserisci il codice evento</h3>
              <p className="text-sm text-[#b8b2b3]">
                Trova il codice stampato sul tuo biglietto ATCL
              </p>
            </div>

            {scanError ? (
              <div className="mb-4 rounded-xl border border-[#2d2728] bg-[#1a1617] px-4 py-3 text-center">
                <p className="text-white mb-1">QR non valido</p>
                <p className="text-sm text-[#b8b2b3]">{scanError}</p>
              </div>
            ) : null}

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="es. ATCL-001"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="text-center uppercase"
              />
              
              <Button type="submit" variant="primary" size="lg" fullWidth>
                Conferma codice
              </Button>
              
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                className="w-full rounded-md py-[10px] text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
              >
                Torna alla scansione QR
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
