import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Camera, X } from 'lucide-react';

interface CameraScannerProps {
  onResult: (barcode: string | null, imageBase64: string | null) => void;
  onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onResult, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
    let isComponentMounted = true;
    const codeReader = new BrowserMultiFormatReader();

    const startScanner = async () => {
      try {
        // 1. Force permission prompt using native HTML5 API first
        // This guarantees the browser asks for permission and unlocks the device list
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API blocked by browser. You MUST use 'localhost' or an 'https://' link.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());

        // 2. Now that permissions are granted, safely read the full device list
        const videoInputDevices = await codeReader.listVideoInputDevices();
        if (isComponentMounted) {
          setDevices(videoInputDevices);
        }

        // 3. Select a valid device ID (use selected, or fallback to the laptop webcam)
        let deviceIdToUse = selectedDeviceId;
        if (!deviceIdToUse && videoInputDevices.length > 0) {
           // Explicitly try to find the laptop's built-in webcam
           const laptopWebcam = videoInputDevices.find(d => {
             const label = d.label.toLowerCase();
             return label.includes('integrated') || 
                    label.includes('front') || 
                    label.includes('facetime') || 
                    label.includes('webcam') || 
                    label.includes('usb');
           });
           
           deviceIdToUse = laptopWebcam ? laptopWebcam.deviceId : videoInputDevices[0].deviceId;
        }

        // 4. Start ZXing with a guaranteed valid device string
        codeReader.decodeFromVideoDevice(deviceIdToUse || null, videoRef.current!, (result, err) => {
          if (!isComponentMounted) return;
          if (result) {
            onResult(result.getText(), null);
            codeReader.reset();
          }
        });
      } catch (err: any) {
        if (isComponentMounted) setError('Camera error: ' + err.message);
      }
    };

    startScanner();

    return () => {
      isComponentMounted = false;
      codeReader.reset();
    };
  }, [selectedDeviceId, onResult]);

  const handleManualCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg');
        onResult(null, base64);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-xl overflow-hidden shadow-2xl max-w-md w-full relative flex flex-col">
        <div className="flex justify-between items-center p-4 bg-base-200">
          <h3 className="font-bold flex items-center gap-2">
            <Camera className="w-5 h-5" />
            AI Vision Scanner
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {devices.length > 0 && (
          <div className="p-2 bg-base-200 border-t border-base-300 flex justify-center">
            <select 
              className="select select-sm select-bordered w-full max-w-xs"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
            >
              <option value="">Auto (Default Camera)</option>
              {devices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="relative bg-black aspect-video flex items-center justify-center">
          {error ? (
            <p className="text-error p-4 text-center">{error}</p>
          ) : (
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
          )}
          <div className="absolute inset-0 border-2 border-primary opacity-50 m-8 rounded-lg pointer-events-none"></div>
        </div>
        <div className="p-4 text-center flex flex-col gap-3">
          <div className="text-sm text-base-content/70">
            Scanning for barcode... Or capture manually for AI Vision.
          </div>
          <button 
            type="button" 
            className="btn btn-primary w-full"
            onClick={handleManualCapture}
          >
            <Camera className="w-4 h-4" />
            Capture Image for AI
          </button>
        </div>
      </div>
    </div>
  );
};
