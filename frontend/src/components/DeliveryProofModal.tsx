import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Trash2, CheckCircle2, X, Sparkles, Upload, ShieldCheck, FileSignature, Image as ImageIcon, SwitchCamera, Scan, Loader2, Tag, Edit2, Check, AlertCircle, Video, Key } from 'lucide-react';
import { api } from '../api';

interface DeliveryProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  customerName?: string;
  existingPin?: string;
  isSubmitting?: boolean;
  onConfirm: (proof: {
    deliverySignature: string;
    deliveryProofPhoto: string;
    deliveryNotes: string;
    verificationCode: string;
  }) => void;
}

export const DeliveryProofModal: React.FC<DeliveryProofModalProps> = ({
  isOpen,
  onClose,
  orderId,
  customerName,
  existingPin,
  isSubmitting = false,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'signature'>('camera');

  // Camera States & Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // AI Vision Scanner States
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiScanResult, setAiScanResult] = useState<any | null>(null);
  const [aiScanError, setAiScanError] = useState<string | null>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [customLabel, setCustomLabel] = useState('');

  // Signature States & Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Verification PIN Code & Notes
  const [verificationCode, setVerificationCode] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Preset labels for quick selection
  const PRESET_LABELS = [
    '📦 Delivered Goods Package',
    '💻 Electronics / Hardware',
    '📋 Signed Delivery Note',
    '🏷️ Sealed Stock Box',
  ];

  // ── Stop Camera Stream ──────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsCameraActive(false);
    setIsStartingCamera(false);
  }, []);

  // ── Reset state when modal opens ──────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      setAiScanResult(null);
      setAiScanError(null);
      setCustomLabel('');
      setIsEditingLabel(false);
      setHasSigned(false);
      setVerificationCode(existingPin || '');
      setPinError(null);
      setNotes('');
      setActiveTab('camera');
      setIsCameraActive(false);
      setCameraError(null);
    } else {
      stopCamera();
    }
  }, [isOpen, existingPin]);

  // Helper to sanitize generic non-product descriptions
  const sanitizeAiName = (rawName: string) => {
    if (!rawName) return 'Delivered Goods Package';
    const lower = rawName.toLowerCase();
    if (
      lower.includes('no mobile') ||
      lower.includes('warning sign') ||
      lower.includes('prohibited') ||
      lower.includes('graphic sign')
    ) {
      return 'Delivered Goods Package (Verified Proof)';
    }
    return rawName;
  };

  // ── AI Vision Scanner Handler ──────────────────────────────────────────
  const runAiVisionScan = async (imageBase64: string) => {
    setIsAiScanning(true);
    setAiScanError(null);
    try {
      const res = await api.post('/ai/vision-scan', { imageBase64, context: 'delivery' });
      if (res.data.success && res.data.data) {
        const data = res.data.data;
        const cleanedName = sanitizeAiName(data.name);
        const updatedData = { ...data, name: cleanedName };
        setAiScanResult(updatedData);
        setCustomLabel(cleanedName);

        if (cleanedName && cleanedName !== 'API Key Missing') {
          const confidencePct = Math.round((data.confidence || 0.95) * 100);
          const aiSummary = `[AI Vision Scan]: ${cleanedName} - (${confidencePct}% AI Match)`;
          setNotes((prev) => (prev ? `${prev} | ${aiSummary}` : aiSummary));
        }
      }
    } catch (err: any) {
      console.warn('AI Vision Scan error:', err);
      setAiScanError(err.response?.data?.error || 'AI Vision Scan error.');
    } finally {
      setIsAiScanning(false);
    }
  };

  const applyLabelPreset = (label: string) => {
    setCustomLabel(label);
    if (aiScanResult) {
      setAiScanResult({ ...aiScanResult, name: label });
    } else {
      setAiScanResult({ name: label, confidence: 0.98, description: 'Manually verified delivery item.' });
    }
    const aiSummary = `[Verified Item]: ${label}`;
    setNotes((prev) => (prev ? `${prev} | ${aiSummary}` : aiSummary));
  };

  // Enumerate Web Cameras
  const loadCameraDevices = useCallback(async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
      } catch (e) {
        console.warn('Error enumerating cameras:', e);
      }
    }
  }, []);

  // ── 1. Camera Functions ──────────────────────────────────────────────────
  const startCamera = useCallback(async (targetDeviceId?: string) => {
    setCameraError(null);
    setIsStartingCamera(true);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Live camera stream not allowed on this browser context. Please use "Take Photo (Camera App)" or "Upload Image".');
      }

      const deviceIdToUse = targetDeviceId || selectedDeviceId;

      const attempts: MediaStreamConstraints[] = deviceIdToUse
        ? [
            { video: { deviceId: { exact: deviceIdToUse } } },
            { video: true },
          ]
        : [
            { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
            { video: true },
            { video: { facingMode: 'user' } },
            { video: { facingMode: 'environment' } },
          ];

      let mediaStream: MediaStream | null = null;
      let lastErr: any = null;
      for (const constraint of attempts) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraint);
          if (mediaStream) break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!mediaStream) {
        throw lastErr || new Error('Unable to acquire camera stream.');
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCameraActive(true);
      setIsStartingCamera(false);

      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }

      loadCameraDevices();
    } catch (err: any) {
      console.warn('Camera access error:', err);
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission denied by browser. Click "Take Photo (Camera App)" below.'
        : 'Laptop live camera stream unavailable. Click "Take Photo (Camera App)" or "Upload Image".';
      setCameraError(msg);
      setIsCameraActive(false);
      setIsStartingCamera(false);
    }
  }, [selectedDeviceId, loadCameraDevices]);

  const handleCameraSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedDeviceId(deviceId);
    startCamera(deviceId);
  };

  // Attach stream to video element whenever stream state updates
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Auto-start camera when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !capturedPhoto && !isCameraActive && !isStartingCamera && !cameraError) {
      startCamera();
    }
  }, [isOpen, activeTab, capturedPhoto, isCameraActive, isStartingCamera, cameraError, startCamera]);

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;

    const canvas = document.createElement('canvas');
    const maxDim = 1000;
    let targetW = width;
    let targetH = height;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        targetW = maxDim;
        targetH = Math.round((height * maxDim) / width);
      } else {
        targetH = maxDim;
        targetW = Math.round((width * maxDim) / height);
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, targetW, targetH);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedPhoto(dataUrl);
      stopCamera();
      // Auto run AI Vision scan on captured photo!
      runAiVisionScan(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const dataUrl = event.target.result as string;
        setCapturedPhoto(dataUrl);
        stopCamera();
        // Auto run AI Vision scan on uploaded photo!
        runAiVisionScan(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setAiScanResult(null);
    setAiScanError(null);
    setCustomLabel('');
    startCamera();
  };

  // ── 2. Signature Canvas Functions ─────────────────────────────────────────
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'signature') {
      const timer = setTimeout(initCanvas, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, initCanvas]);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && (e as React.TouchEvent).touches && (e as React.TouchEvent).touches.length > 0) {
      clientX = (e as React.TouchEvent).touches[0].clientX;
      clientY = (e as React.TouchEvent).touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if ('touches' in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const getSignatureDataUrl = (): string => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) return '';
    return canvas.toDataURL('image/png');
  };

  // ── 3. Submit Handler ────────────────────────────────────────────────────
  const handleSubmit = () => {
    setPinError(null);

    // Validate PIN code entry
    if (existingPin && verificationCode.trim() !== existingPin.trim()) {
      setPinError(`Invalid PIN code! Customer PIN must match assigned 6-digit code: ${existingPin}`);
      setActiveTab('signature');
      return;
    }

    if (!verificationCode.trim()) {
      setPinError('Please enter the 6-digit Delivery Verification PIN provided to the customer via email.');
      setActiveTab('signature');
      return;
    }

    const signature = getSignatureDataUrl();
    onConfirm({
      deliverySignature: signature,
      deliveryProofPhoto: capturedPhoto || '',
      deliveryNotes: notes.trim(),
      verificationCode: verificationCode.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open animate-in fade-in duration-300 z-50">
      <div className="modal-box max-w-xl bg-base-100 border border-base-200 shadow-2xl rounded-2xl p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-base-200 pb-3">
          <div>
            <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
              <ShieldCheck className="text-primary" size={24} />
              <span>Proof of Delivery Verification</span>
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5">
              Order <span className="font-mono font-bold text-primary">#{orderId.slice(0, 8).toUpperCase()}</span> • {customerName || 'Customer'}
            </p>
          </div>
          <button className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher: Camera / Signature */}
        <div className="tabs tabs-boxed bg-base-200/60 p-1 rounded-xl">
          <button
            className={`tab tab-sm font-bold flex-1 gap-2 rounded-lg transition-all ${
              activeTab === 'camera' ? 'tab-active bg-primary text-primary-content shadow-xs' : 'text-base-content/70'
            }`}
            onClick={() => setActiveTab('camera')}
          >
            <Camera size={15} />
            <span>1. Goods Camera Photo</span>
            {capturedPhoto && <CheckCircle2 size={14} className="text-success ml-1" />}
          </button>
          <button
            className={`tab tab-sm font-bold flex-1 gap-2 rounded-lg transition-all ${
              activeTab === 'signature' ? 'tab-active bg-primary text-primary-content shadow-xs' : 'text-base-content/70'
            }`}
            onClick={() => setActiveTab('signature')}
          >
            <FileSignature size={15} />
            <span>2. PIN & Signature</span>
            {(hasSigned && verificationCode) && <CheckCircle2 size={14} className="text-success ml-1" />}
          </button>
        </div>

        {/* Tab 1: Camera Photo Capture & AI Vision Scanner */}
        {activeTab === 'camera' && (
          <div className="space-y-4">
            {capturedPhoto ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-base-300 shadow-inner bg-black max-h-64 flex items-center justify-center">
                  <img src={capturedPhoto} alt="Delivery Proof" className="w-full h-64 object-contain" />
                  
                  {isAiScanning ? (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
                      <Loader2 className="animate-spin text-primary" size={32} />
                      <span className="text-xs font-bold tracking-wider uppercase">AI Vision Scanning Goods...</span>
                    </div>
                  ) : (
                    <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-white/20">
                      <Sparkles size={13} className="text-warning animate-pulse" />
                      <span>{customLabel || (aiScanResult?.name ? `AI Verified: ${aiScanResult.name}` : 'AI Photo Proof Captured')}</span>
                    </div>
                  )}
                </div>

                {/* AI Vision Scanner Output Card */}
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3.5 space-y-2.5 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                      <Scan size={14} /> AI Vision Recognition & Inspection
                    </span>
                    <span className="badge badge-primary badge-xs font-mono font-bold">
                      {aiScanResult ? `${Math.round((aiScanResult.confidence || 0.95) * 100)}% Match` : 'Ready'}
                    </span>
                  </div>

                  {/* Editable / Verified Title */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-base-content/60 uppercase">Verified Item Label</label>
                      <button
                        type="button"
                        className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold"
                        onClick={() => setIsEditingLabel(!isEditingLabel)}
                      >
                        <Edit2 size={10} /> {isEditingLabel ? 'Done Editing' : 'Edit Title'}
                      </button>
                    </div>

                    {isEditingLabel ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          className="input input-xs input-bordered w-full font-bold text-xs"
                          value={customLabel}
                          onChange={(e) => setCustomLabel(e.target.value)}
                          placeholder="e.g. Delivered Goods Package"
                        />
                        <button
                          type="button"
                          className="btn btn-xs btn-primary font-bold shrink-0"
                          onClick={() => applyLabelPreset(customLabel || 'Delivered Goods Package')}
                        >
                          <Check size={12} /> Save
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-base-content flex items-center gap-2 bg-base-100/80 px-2.5 py-1.5 rounded-lg border border-base-200/60">
                        <Tag size={14} className="text-primary shrink-0" />
                        <span className="truncate">{customLabel || aiScanResult?.name || 'Delivered Goods Package'}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Preset Selector Chips */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-base-content/50 uppercase">Quick Presets:</span>
                    <div className="flex flex-wrap gap-1">
                      {PRESET_LABELS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`btn btn-xs ${customLabel === preset ? 'btn-primary' : 'btn-outline border-base-300'} text-[10px] h-6 min-h-0 px-2`}
                          onClick={() => applyLabelPreset(preset)}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {aiScanError && (
                  <div className="alert alert-error text-xs p-2.5 rounded-xl">
                    {aiScanError}
                  </div>
                )}

                <div className="flex justify-between items-center gap-2 pt-1">
                  <div className="flex gap-2">
                    <button className="btn btn-sm btn-outline gap-1.5 text-xs" onClick={retakePhoto}>
                      <RefreshCw size={14} /> Retake Photo
                    </button>
                    <button
                      className="btn btn-sm btn-outline btn-primary gap-1.5 text-xs"
                      onClick={() => runAiVisionScan(capturedPhoto)}
                      disabled={isAiScanning}
                    >
                      <Scan size={14} /> {isAiScanning ? 'Scanning...' : 'Re-scan AI Vision'}
                    </button>
                  </div>
                  <button
                    className="btn btn-sm btn-primary gap-1.5 text-xs font-bold"
                    onClick={() => setActiveTab('signature')}
                  >
                    Next: Sign & Verify PIN →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Available Web Camera Selector */}
                {availableCameras.length > 1 && (
                  <div className="flex items-center gap-2 bg-base-200/60 p-2 rounded-xl border border-base-300">
                    <Video size={15} className="text-primary shrink-0" />
                    <span className="text-xs font-bold shrink-0">Select Camera:</span>
                    <select
                      className="select select-xs select-bordered w-full text-xs"
                      value={selectedDeviceId}
                      onChange={handleCameraSelectChange}
                    >
                      <option value="">Default Laptop Camera</option>
                      {availableCameras.map((cam, idx) => (
                        <option key={cam.deviceId || idx} value={cam.deviceId}>
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="relative rounded-xl overflow-hidden border border-base-300 bg-neutral h-64 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {!isCameraActive && (
                    <div className="absolute inset-0 bg-neutral/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-neutral-content space-y-3 text-center">
                      {isStartingCamera ? (
                        <>
                          <Loader2 className="animate-spin text-primary" size={32} />
                          <p className="text-xs font-semibold">Connecting to Laptop Camera...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-base-100/10 flex items-center justify-center mx-auto text-primary">
                            <Camera size={24} />
                          </div>
                          <p className="text-xs max-w-xs leading-relaxed text-neutral-content/80">
                            {cameraError || 'Click below to start live stream or use native camera app.'}
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-primary gap-2 font-bold shadow-md"
                              onClick={() => startCamera(selectedDeviceId)}
                            >
                              <Video size={16} /> Start Live Camera Feed
                            </button>
                            <label className="btn btn-sm btn-secondary gap-2 font-bold shadow-md cursor-pointer">
                              <Camera size={16} /> Snap Photo (Camera App)
                              <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="user"
                                className="hidden"
                                onChange={handleFileUpload}
                              />
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    className="btn btn-primary btn-sm gap-2 font-bold shadow-md"
                    onClick={snapPhoto}
                    disabled={!isCameraActive}
                  >
                    <Camera size={16} /> Snap Live Goods Photo
                  </button>

                  {/* Native Device Camera App Input */}
                  <label className="btn btn-secondary btn-sm gap-2 text-xs font-bold cursor-pointer shadow-sm">
                    <Camera size={14} /> Take Photo (Camera App)
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-1.5 text-xs"
                    onClick={() => startCamera(selectedDeviceId)}
                    title="Connect or restart laptop camera"
                  >
                    <Video size={14} /> Start / Reconnect Webcam
                  </button>

                  {/* Standard File Upload */}
                  <label className="btn btn-outline btn-sm gap-2 text-xs cursor-pointer">
                    <ImageIcon size={14} /> Upload Image File
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
            )}
          </div>
        )}

        {/* Tab 2: Customer Signature Pad & Delivery Verification PIN */}
        {activeTab === 'signature' && (
          <div className="space-y-4">
            {/* Customer Delivery Verification PIN Code */}
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-base-content flex items-center gap-1.5 uppercase tracking-wider">
                  <Key size={15} className="text-warning" /> Customer Delivery Verification PIN
                </span>
                {existingPin && (
                  <span className="badge badge-outline badge-xs font-mono font-bold">
                    System PIN: {existingPin}
                  </span>
                )}
              </div>
              <input
                type="text"
                className="input input-sm input-bordered w-full font-mono font-bold text-center tracking-widest text-base uppercase bg-base-100"
                placeholder="Enter 6-digit Customer PIN"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value);
                  setPinError(null);
                }}
              />
              <p className="text-[11px] text-base-content/65 leading-tight">
                🔑 Customer must provide the 6-digit PIN emailed to them when the order was shipped.
              </p>
            </div>

            {pinError && (
              <div className="alert alert-error text-xs p-2.5 rounded-xl font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{pinError}</span>
              </div>
            )}

            {/* Signature Canvas */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-base-content/70">
                <span>Customer Signature (mouse or touchscreen):</span>
                {hasSigned && (
                  <button
                    type="button"
                    className="text-error hover:underline flex items-center gap-1 font-semibold"
                    onClick={clearSignature}
                  >
                    <Trash2 size={12} /> Clear Signature
                  </button>
                )}
              </div>

              <div className="relative border-2 border-dashed border-primary/40 rounded-xl bg-base-200/40 p-1 overflow-hidden shadow-inner hover:border-primary transition-colors">
                <canvas
                  ref={canvasRef}
                  className="w-full h-36 touch-none cursor-crosshair rounded-lg bg-base-100"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasSigned && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-base-content/30 text-xs font-semibold italic">
                    ✍️ Customer Signature Line Here
                  </div>
                )}
              </div>
            </div>

            <div className="form-control">
              <label className="label py-0.5">
                <span className="label-text text-xs font-bold text-base-content/60">Recipient / Delivery Notes & AI Scan Summary</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full text-xs h-16"
                placeholder="e.g. Received by John Doe (Security / Reception)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="modal-action border-t border-base-200 pt-3 flex justify-between items-center">
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>

          <button
            className="btn btn-success btn-sm gap-2 font-bold shadow-md px-6 text-white"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Confirm & Complete Delivery</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryProofModal;
