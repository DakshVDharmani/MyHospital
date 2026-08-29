import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet's default marker icon references relative image paths that break
// under Vite's bundling — point it at the bundled asset URLs instead. Only
// needs doing once, at module load.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface LocationMapProps {
  latitude: number;
  longitude: number;
  label?: string;
  height?: number;
}

/** A small, self-contained Leaflet map pinned to one point — built the same
 * imperative way as this app's three.js scenes (a mount ref + its own
 * lifecycle), so it doesn't pull in a React wrapper library. */
export function LocationMap({ latitude, longitude, label, height = 160 }: LocationMapProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const map = L.map(mountRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    }).setView([latitude, longitude], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([latitude, longitude]).addTo(map);
    if (label) marker.bindPopup(label);

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Only (re)create the map once per mount — position updates are handled
    // by the effect below so the map doesn't tear down/rebuild on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
    markerRef.current.setLatLng([latitude, longitude]);
    if (label) markerRef.current.bindPopup(label);
  }, [latitude, longitude, label]);

  return <div ref={mountRef} style={{ height, width: '100%', borderRadius: 12 }} />;
}
