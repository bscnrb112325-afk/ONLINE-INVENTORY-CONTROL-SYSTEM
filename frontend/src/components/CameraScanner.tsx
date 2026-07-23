import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Camera, X, RefreshCw, Upload, Video, Sparkles } from 'lucide-react';

interface CameraScannerProps {
  onResult: (barcode: string | null, imageBase64: string | null) => void;
  onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onResult, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStartingStream, setIsStartingStream] = useState<boolean>(true);

  const startScanner = useCallback(async () => {
    setIsStartingStream(true);
    setError('');
    const codeReader = new BrowserMultiFormatReader();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not allowed in this context. Use 'Snap Photo (Camera App)' or 'Upload Image'.");
      }

      // First check permission / enumerate video devices
      const videoInputDevices = await codeReader.listVideoInputDevices();
      setDevices(videoInputDevices);

      let deviceIdToUse = selectedDeviceId;
      if (!deviceIdToUse && videoInputDevices.length > 0) {
        const webcam = videoInputDevices.find(d => {
          const label = d.label.toLowerCase();
          return label.includes('integrated') || 
                 label.includes('front') || 
                 label.includes('facetime') || 
                 label.includes('webcam') || 
                 label.includes('usb');
        });
        deviceIdToUse = webcam ? webcam.deviceId : videoInputDevices[0].deviceId;
      }

      codeReader.decodeFromVideoDevice(deviceIdToUse || null, videoRef.current!, (result) => {
        if (result) {
          onResult(result.getText(), null);
          codeReader.reset();
        }
      });
      setIsStartingStream(false);
    } catch (err: any) {
      console.warn("CameraScanner error:", err);
      setError("Live video feed unavailable. Use native camera app or image upload below.");
      setIsStartingStream(false);
    }

    return () => {
      codeReader.reset();
    };
  }, [selectedDeviceId, onResult]);

  useEffect(() => {
    let cleanup: any;
    startScanner().then(c => { cleanup = c; });
    return () => {
      if (cleanup) cleanup();
    };
  }, [startScanner]);

  const handleManualCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        onResult(null, base64);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onResult(null, event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-base-100 rounded-2xl overflow-hidden shadow-2xl max-w-md w-full relative flex flex-col border border-base-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 bg-base-200/80 border-b border-base-300">
          <h3 className="font-bold text-sm flex items-center gap-2 text-base-content">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span>AI Product & Barcode Vision Scanner</span>
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Device Switcher Dropdown */}
        {devices.length > 1 && (
          <div className="p-2 bg-base-200/50 border-b border-base-300 flex items-center gap-2 px-4">
            <Video size={14} className="text-primary shrink-0" />
            <select 
              className="select select-xs select-bordered w-full text-xs"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
            >
              <option value="">Default Laptop Camera</option>
              {devices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Video Preview Container */}
        <div className="relative bg-neutral aspect-video flex items-center justify-center overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>

          {error && (
            <div className="absolute inset-0 bg-neutral/95 flex flex-col items-center justify-center p-4 text-center space-y-2">
              <p className="text-xs text-neutral-content/80 max-w-xs">{error}</p>
              <button
                type="button"
                className="btn btn-xs btn-outline btn-primary gap-1"
                onClick={startScanner}
              >
                <RefreshCw size={12} /> Retry Camera Feed
              </button>
            </div>
          )}

          {!error && (
            <div className="absolute inset-0 border-2 border-primary/50 m-6 rounded-xl pointer-events-none flex items-center justify-center">
              <div className="text-[10px] text-white/70 bg-black/60 px-2 py-0.5 rounded-full font-mono">
                Position Barcode or Product inside frame
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-4 space-y-2.5 bg-base-100">
          <button 
            type="button" 
            className="btn btn-primary btn-sm w-full font-bold gap-2 text-xs shadow-md"
            onClick={handleManualCapture}
          >
            <Camera className="w-4 h-4" />
            Snap Photo for AI Identification
          </button>

          <div className="grid grid-cols-2 gap-2">
            <label className="btn btn-secondary btn-outline btn-xs gap-1.5 font-bold cursor-pointer">
              <Camera className="w-3.5 h-3.5" />
              Camera App
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            <label className="btn btn-outline btn-xs gap-1.5 font-bold cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Upload Image
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

      </div>
    </div>
  );
};
