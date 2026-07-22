import React, { useEffect, useRef } from 'react';

// Inject Leaflet CSS once
function injectLeafletCSS() {
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

interface DeliveryMapProps {
  lat: number;
  lng: number;
  address?: string;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ lat, lng, address }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    injectLeafletCSS();

    let map: any;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;

      if (cancelled || !containerRef.current) return;

      // Destroy previous instance if any
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Fix broken icon URLs in bundlers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      // Custom pin icon
      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px; height:32px;
          background: oklch(var(--p, 60% 0.2 270));
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
          display:flex; align-items:center; justify-content:center;
        "><div style="width:9px;height:9px;background:white;border-radius:50%;transform:rotate(45deg)"></div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);

      if (address) {
        marker.bindPopup(
          `<div style="font-size:11px; max-width:200px; line-height:1.4">
            <strong>📍 Delivery Address</strong><br/>${address}
           </div>`,
          { maxWidth: 220 }
        );
      }

      mapRef.current = map;

      // Let CSS settle before invalidating size
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 150);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, address]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden', zIndex: 1 }}
    />
  );
};

export default DeliveryMap;
