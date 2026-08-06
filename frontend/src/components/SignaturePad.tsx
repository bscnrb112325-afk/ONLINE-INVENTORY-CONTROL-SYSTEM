import React, { useRef, useState, useEffect } from 'react';

const SignaturePad = ({ onSave, onCancel }: { onSave: (dataUrl: string) => void, onCancel: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale to map CSS pixels to actual canvas pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL('image/png'));
    }
  };
  
  const handleClear = () => {
     const canvas = canvasRef.current;
     if (canvas) {
       const ctx = canvas.getContext('2d');
       if (ctx) {
         ctx.fillStyle = '#ffffff';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
       }
     }
  };

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, []);

  return (
    <div className="flex flex-col gap-2 w-full animate-in fade-in zoom-in duration-300">
      <div className="border-2 border-base-300 bg-white rounded-lg cursor-crosshair touch-none overflow-hidden relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={250}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-auto aspect-[2.4/1]"
        />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <span className="text-4xl font-bold tracking-widest text-black/10 select-none">SIGN HERE</span>
        </div>
      </div>
      <div className="flex justify-between items-center mt-2">
        <button type="button" className="btn btn-sm btn-ghost text-error" onClick={handleClear}>Clear</button>
        <div className="space-x-2">
          <button type="button" className="btn btn-sm btn-outline" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={handleSave}>Save Signature</button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
