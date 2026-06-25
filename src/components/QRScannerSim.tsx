import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertCircle, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (ticketId: string) => void;
  isLoading?: boolean;
}

export function QRScannerSim({ onScanSuccess, isLoading }: QRScannerProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Audio beep settings
  const [soundEnabled, setSoundEnabled] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Sound Synth Generator (Web Audio API - zero external file dependency)
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = 1200; // Crisp high-pitch scan beep
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12); // Short beep

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn('Audio context error:', e);
    }
  };

  // Decode scanner inputs
  const handleDecodedText = (text: string) => {
    playBeep();
    let ticketId = text.trim();
    
    // Check if QR text is encoded JSON format
    try {
      if (text.startsWith('{')) {
        const parsed = JSON.parse(text);
        if (parsed.ticketId) {
          ticketId = parsed.ticketId;
        }
      }
    } catch (e) {
      // Not JSON, use raw text
    }

    onScanSuccess(ticketId);
  };

  // Camera scanner control hook
  useEffect(() => {
    let html5Qrcode: Html5Qrcode | null = null;

    if (cameraActive) {
      setCameraError(null);
      
      const startScanner = async () => {
        try {
          // Add small delay to let container mount fully
          await new Promise((resolve) => setTimeout(resolve, 100));
          
          html5Qrcode = new Html5Qrcode('camera-qr-reader');
          scannerRef.current = html5Qrcode;

          await html5Qrcode.start(
            { facingMode: 'environment' },
            {
              fps: 25,
              qrbox: (width, height) => {
                const side = Math.min(width, height);
                const size = Math.round(side * 0.6);
                const finalSize = Math.max(150, size);
                if (finalSize > side) {
                  const safeSide = Math.max(50, side);
                  return { width: safeSide, height: safeSide };
                }
                return { width: finalSize, height: finalSize };
              }
            },
            (decodedText) => {
              handleDecodedText(decodedText);
              // Pause camera scanning briefly after a success to prevent rapid re-scans
              setCameraActive(false);
            },
            () => {
              // Verbose scan failures (ignored)
            }
          );
        } catch (err: any) {
          console.warn('Camera startup info:', err);
          setCameraError(
            'Camera access was denied or is unavailable. Please check your browser site settings and permit camera access to use real-time QR ticket verification.'
          );
          setCameraActive(false);
        }
      };

      startScanner();
    }

    return () => {
      if (html5Qrcode) {
        if (html5Qrcode.isScanning) {
          html5Qrcode.stop().then(() => {
            html5Qrcode?.clear();
          }).catch((err) => console.warn('Error stopping scanner:', err));
        }
      }
    };
  }, [cameraActive]);

  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-3xs overflow-hidden">
      {/* Header controls & Tabs */}
      <div className="bg-slate-50 border-b border-slate-100 p-3 flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Camera className="h-4 w-4 text-indigo-600 animate-pulse" />
          <span className="text-xs font-bold text-slate-800">QR Ticket Scanner</span>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-1.5 hover:bg-slate-200 rounded-lg cursor-pointer text-slate-500 transition`}
          title={soundEnabled ? 'Mute Scan Beep' : 'Unmute Scan Beep'}
        >
          {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-indigo-600" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="p-4">
        <div className="space-y-4">
          {cameraActive ? (
            <div className="relative border-2 border-slate-800 rounded-xl bg-slate-950 overflow-hidden shadow-inner h-60">
              <div id="camera-qr-reader" className="w-full h-full object-cover [&>div]:border-0 [&>div]:p-0" />
              
              {/* Framing corners for scan scope */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-3 border-l-3 border-indigo-500 rounded-tl-md pointer-events-none" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-3 border-r-3 border-indigo-500 rounded-tr-md pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-3 border-l-3 border-indigo-500 rounded-bl-md pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-3 border-r-3 border-indigo-500 rounded-br-md pointer-events-none" />
              
              {/* Real-time laser scanning line animation */}
              <div className="absolute left-4 right-4 h-0.5 bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-bounce top-1/2 pointer-events-none" />

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 rounded text-[10px] text-slate-300 font-bold tracking-wider uppercase font-mono">
                Align Passenger QR Code
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 border-dashed rounded-xl bg-slate-50 p-6 text-center space-y-4">
              <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600">
                <Camera className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-[240px] mx-auto">
                <h4 className="text-xs font-bold text-slate-850">Camera Scanning Offline</h4>
                <p className="text-[10px] text-slate-400">
                  Click below to activate the camera and verify digital or printed passenger ticket QR codes in real-time.
                </p>
              </div>
              <button
                onClick={() => setCameraActive(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition shadow-3xs inline-flex items-center gap-1.5"
              >
                <Camera className="h-3.5 w-3.5" />
                Start Scanner Camera
              </button>
            </div>
          )}

          {cameraError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-850 p-3 rounded-lg text-[11px] font-semibold flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
