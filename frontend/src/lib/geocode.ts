export interface GeocodeResult {
  latitude: number;
  longitude: number;
  /** The geocoder's normalized, human-readable form of the address. */
  displayName: string;
}

type NominatimHit = { lat: string; lon: string; display_name: string };

function toResult(hit: NominatimHit): GeocodeResult {
  return { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon), displayName: hit.display_name };
}

/**
 * Turns a free-text address into coordinates using OpenStreetMap's Nominatim
 * API — free, no API key, pairs naturally with Leaflet (same OSM data). Only
 * for occasional, user-initiated lookups (one address save at a time): it's
 * rate-limited to ~1 request/second and asks that requests aren't automated.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);

  const results: NominatimHit[] = await res.json();
  return results.length ? toResult(results[0]) : null;
}

/**
 * Returns up to `limit` address candidates for a partial, in-progress query —
 * the typeahead behind the address field's suggestion dropdown. Pass an
 * AbortSignal so a fresh keystroke can cancel the previous, now-stale request
 * rather than letting responses race and land out of order.
 */
export async function searchAddresses(query: string, opts: { limit?: number; signal?: AbortSignal } = {}): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const { limit = 5, signal } = opts;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=${limit}&q=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(`Address search failed (${res.status})`);

  const results: NominatimHit[] = await res.json();
  return results.map(toResult);
}
