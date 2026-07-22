import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, X, Locate, CheckCircle, Navigation } from 'lucide-react';

// Leaflet CSS — injected once into <head>
function injectLeafletCSS() {
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

interface LocationResult {
  address: string;
  lat: number;
  lng: number;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: LocationResult) => void;
  initialAddress?: string;
}

// Default centre: Nairobi CBD
const DEFAULT_LAT = -1.2921;
const DEFAULT_LNG = 36.8219;

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialAddress = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [address, setAddress] = useState(initialAddress);
  const [coords, setCoords] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reverse geocode via Nominatim ─────────────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data?.display_name) {
        setAddress(data.display_name);
      }
    } catch {
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  }, []);

  // ── Move marker + pan map ─────────────────────────────────────────────────
  const moveMarker = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (mapRef.current) {
      mapRef.current.panTo([lat, lng]);
    }
  }, []);

  // ── Initialise Leaflet map ────────────────────────────────────────────────
  const initMap = useCallback(async () => {
    if (!mapContainerRef.current || mapRef.current) return;

    injectLeafletCSS();

    const L = (await import('leaflet')).default;

    // Fix default marker icon path broken by bundlers
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapContainerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const customIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:36px;height:36px;
        background:oklch(var(--p));
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      "><div style="width:10px;height:10px;background:white;border-radius:50%;transform:rotate(45deg)"></div></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    const marker = L.marker([coords.lat, coords.lng], {
      icon: customIcon,
      draggable: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setCoords({ lat: pos.lat, lng: pos.lng });
      reverseGeocode(pos.lat, pos.lng);
    });

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCoords({ lat, lng });
      reverseGeocode(lat, lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    setIsMapReady(true);

    // Fix Leaflet tile sizing after modal animation
    setTimeout(() => map.invalidateSize(), 200);
  }, [coords.lat, coords.lng, reverseGeocode]);

  // ── Open/close lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setAddress(initialAddress);
      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);
      setTimeout(() => initMap(), 80); // wait for modal DOM
    } else {
      // Destroy map on close so it re-inits fresh next time
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        setIsMapReady(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Forward geocode search (Nominatim) ────────────────────────────────────
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (q.trim().length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1&countrycodes=ke`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setAddress(result.display_name);
    setSearchQuery('');
    setShowDropdown(false);
    moveMarker(lat, lng);
    setCoords({ lat, lng });
    if (mapRef.current) mapRef.current.setZoom(16);
  };

  // ── GPS locate me ──────────────────────────────────────────────────────────
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        moveMarker(lat, lng);
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
        if (mapRef.current) mapRef.current.setZoom(17);
        setIsLocating(false);
      },
      (err) => {
        alert('Could not get your location: ' + err.message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Confirm ───────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    const finalAddress = address.trim() || searchQuery.trim();
    if (!finalAddress) {
      alert('Please select or type a delivery address.');
      return;
    }
    onConfirm({ address: finalAddress, lat: coords.lat, lng: coords.lng });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-[9999]" style={{ position: 'fixed', inset: 0 }}>
      <div
        className="modal-box rounded-2xl w-full max-w-2xl p-0 overflow-hidden border border-base-200 shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-200 bg-base-100 shrink-0">
          <h3 className="font-bold text-base flex items-center gap-2 text-base-content">
            <MapPin className="text-primary" size={20} />
            Pin Your Delivery Location
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Search Bar ───────────────────────────────────────────────── */}
        <div className="px-4 py-2.5 bg-base-100 border-b border-base-200 shrink-0">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none z-10"
              />
              {isSearching && (
                <span className="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
              )}
              <input
                type="text"
                id="location-search-input"
                className="input input-bordered input-sm w-full pl-9 pr-4 text-sm"
                placeholder="Search street, estate, or landmark in Kenya..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
                autoComplete="off"
              />
              {/* Search Results Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <ul className="absolute z-[10000] left-0 right-0 top-full mt-1 bg-base-100 border border-base-200 rounded-xl shadow-xl overflow-hidden">
                  {searchResults.map((r, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 transition-colors flex items-start gap-2"
                        onMouseDown={() => selectSearchResult(r)}
                      >
                        <MapPin size={12} className="text-primary mt-0.5 shrink-0" />
                        <span className="line-clamp-2 leading-snug">{r.display_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline gap-1.5 shrink-0"
              onClick={handleLocateMe}
              disabled={isLocating}
              title="Use my current GPS location"
            >
              {isLocating
                ? <span className="loading loading-spinner loading-xs" />
                : <Locate size={14} />}
              <span className="hidden sm:inline text-xs">Locate Me</span>
            </button>
          </div>
        </div>

        {/* ── Map ──────────────────────────────────────────────────────── */}
        <div className="relative flex-1 min-h-0" style={{ height: '360px' }}>
          {/* Loading overlay */}
          {!isMapReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-200/80 z-10 gap-3">
              <span className="loading loading-spinner loading-lg text-primary" />
              <p className="text-sm text-base-content/60 font-medium">Loading map…</p>
            </div>
          )}

          {/* Hint badge */}
          {isMapReady && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
              <span className="badge badge-neutral badge-sm shadow text-[10px] font-semibold opacity-85">
                Click map or drag the pin to set your exact location
              </span>
            </div>
          )}

          {/* Leaflet map container */}
          <div
            ref={mapContainerRef}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="px-5 py-4 bg-base-100 border-t border-base-200 space-y-3 shrink-0">
          {/* Selected address */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest">
              Selected Delivery Address
            </label>
            <div className="relative">
              <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
              <input
                type="text"
                className="input input-bordered input-sm w-full pl-8 pr-4 text-xs font-medium"
                placeholder="Address will appear after pinning on map…"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            {coords.lat !== DEFAULT_LAT && coords.lng !== DEFAULT_LNG && (
              <p className="text-[10px] font-mono text-base-content/35 pl-1 flex items-center gap-1">
                <Navigation size={9} />
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-2 shadow"
              onClick={handleConfirm}
              disabled={!address.trim() && !searchQuery.trim()}
            >
              <CheckCircle size={14} />
              Confirm Location
            </button>
          </div>
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

export default LocationPickerModal;
