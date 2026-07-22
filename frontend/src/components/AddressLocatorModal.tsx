import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, MapPin, Navigation, ExternalLink, Loader2 } from 'lucide-react';

function injectLeafletCSS() {
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

interface AddressLocatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  lat?: number | null;
  lng?: number | null;
  customerName?: string;
}

const AddressLocatorModal: React.FC<AddressLocatorModalProps> = ({
  isOpen,
  onClose,
  address,
  lat,
  lng,
  customerName,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [resolvedLat, setResolvedLat] = useState<number | null>(lat ?? null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(lng ?? null);
  const [displayAddress, setDisplayAddress] = useState(address);

  // ── Geocode address string via Nominatim ──────────────────────────────────
  const geocodeAddress = useCallback(async (addr: string) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
      }
    } catch {/* fall through */}
    return null;
  }, []);

  // ── Init / destroy map ────────────────────────────────────────────────────
  const buildMap = useCallback(async (mapLat: number, mapLng: number, mapAddress: string) => {
    if (!mapContainerRef.current) return;

    injectLeafletCSS();

    const L = (await import('leaflet')).default;

    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapContainerRef.current, {
      center: [mapLat, mapLng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Custom drop-pin icon
    const pinIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:36px;height:42px">
          <div style="
            width:36px;height:36px;
            background:linear-gradient(135deg,#6366f1,#8b5cf6);
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:3px solid white;
            box-shadow:0 4px 14px rgba(99,102,241,0.5);
            display:flex;align-items:center;justify-content:center;
          "><div style="width:10px;height:10px;background:white;border-radius:50%;transform:rotate(45deg)"></div></div>
          <div style="
            position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);
            width:8px;height:8px;background:rgba(99,102,241,0.3);border-radius:50%;
          "></div>
        </div>`,
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -44],
    });

    const marker = L.marker([mapLat, mapLng], { icon: pinIcon }).addTo(map);
    marker.bindPopup(
      `<div style="font-size:12px;max-width:220px;line-height:1.5">
        <div style="font-weight:700;margin-bottom:4px">📦 Delivery Location</div>
        ${customerName ? `<div style="font-weight:600;color:#6366f1">${customerName}</div>` : ''}
        <div style="color:#555;margin-top:4px;font-size:11px">${mapAddress}</div>
       </div>`,
      { maxWidth: 240 }
    ).openPopup();

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);
    setStatus('ready');
  }, [customerName]);

  // ── Lifecycle: open ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    setStatus('loading');

    const init = async () => {
      // Case 1: We already have exact coordinates from the pin
      if (lat != null && lng != null) {
        setResolvedLat(lat);
        setResolvedLng(lng);
        setDisplayAddress(address);
        setTimeout(() => buildMap(lat, lng, address), 100);
        return;
      }

      // Case 2: Only text address — geocode it
      if (address) {
        const result = await geocodeAddress(address);
        if (result) {
          setResolvedLat(result.lat);
          setResolvedLng(result.lng);
          setDisplayAddress(address); // keep original label
          setTimeout(() => buildMap(result.lat, result.lng, address), 100);
        } else {
          setStatus('error');
        }
      } else {
        setStatus('error');
      }
    };

    setTimeout(() => init(), 80); // wait for modal DOM

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, address, lat, lng]);

  if (!isOpen) return null;

  const googleMapsUrl = resolvedLat && resolvedLng
    ? `https://www.google.com/maps?q=${resolvedLat},${resolvedLng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(address)}`;

  return (
    <div className="modal modal-open z-[9999]" style={{ position: 'fixed', inset: 0 }}>
      <div
        className="modal-box rounded-2xl w-full max-w-2xl p-0 overflow-hidden border border-base-200 shadow-2xl flex flex-col"
        style={{ maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-200 bg-base-100 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="text-primary" size={20} />
            <div>
              <h3 className="font-bold text-sm text-base-content leading-tight">Delivery Location</h3>
              {customerName && (
                <p className="text-xs text-base-content/50">{customerName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-xs btn-outline gap-1 text-xs"
              title="Open in Google Maps"
            >
              <ExternalLink size={11} />
              Google Maps
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Address bar */}
        <div className="px-5 py-2.5 bg-base-200/40 border-b border-base-200 shrink-0 flex items-start gap-2">
          <Navigation size={13} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-base-content/80 leading-snug">{displayAddress}</p>
        </div>

        {/* Map */}
        <div className="relative flex-1" style={{ minHeight: '380px' }}>
          {/* Loading overlay */}
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-200/70 z-10 gap-3">
              <Loader2 size={32} className="text-primary animate-spin" />
              <p className="text-sm text-base-content/60 font-medium">
                {lat && lng ? 'Loading map…' : 'Locating address…'}
              </p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-200/50 z-10 gap-4 p-6">
              <div className="w-14 h-14 bg-error/10 rounded-full flex items-center justify-center">
                <MapPin size={28} className="text-error" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm text-base-content mb-1">Could Not Locate Address</p>
                <p className="text-xs text-base-content/60 max-w-xs leading-relaxed">
                  The address "{address}" could not be found on the map. Try opening in Google Maps instead.
                </p>
              </div>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm gap-1.5"
              >
                <ExternalLink size={13} />
                Open in Google Maps
              </a>
            </div>
          )}

          {/* Leaflet container */}
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '380px' }} />

          {/* Coords badge (bottom left) */}
          {status === 'ready' && resolvedLat && resolvedLng && (
            <div className="absolute bottom-2 left-2 z-[500] pointer-events-none">
              <span className="badge badge-neutral badge-sm shadow text-[10px] font-mono opacity-80">
                {resolvedLat.toFixed(6)}, {resolvedLng.toFixed(6)}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-base-100 border-t border-base-200 flex justify-between items-center shrink-0">
          <p className="text-[10px] text-base-content/40">
            {lat && lng ? '📍 Pinned by customer on ZuriShop' : '🔍 Geocoded from typed address'}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className="modal-backdrop"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />
    </div>
  );
};

export default AddressLocatorModal;
