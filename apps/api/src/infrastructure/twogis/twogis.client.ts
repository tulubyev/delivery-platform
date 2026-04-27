const API_KEY = process.env.TWOGIS_API_KEY!

const GEOCODER_BASE  = 'https://catalog.api.2gis.com/3.0/items/geocode'
const MATRIX_BASE    = 'https://routing.api.2gis.com/get_dist_matrix'
const DIRECTIONS_BASE = 'https://routing.api.2gis.com/routing/7.0.0/global'

export interface GeocodedPoint {
  lat:     number
  lon:     number
  full_name: string
}

export interface MatrixResult {
  // rows[i][j] = { duration_seconds, distance_meters } from point i to point j
  rows: Array<Array<{ duration_seconds: number; distance_meters: number } | null>>
}

export interface RouteSegment {
  distance_meters: number
  duration_seconds: number
  polyline: string // encoded polyline
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`2GIS API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

export const twogisClient = {
  async geocode(address: string, regionId = '1'): Promise<GeocodedPoint | null> {
    const url = `${GEOCODER_BASE}?q=${encodeURIComponent(address)}&fields=items.point&region_id=${regionId}&key=${API_KEY}`
    const data = await fetchJson<{ result?: { items?: Array<{ point: { lat: number; lon: number }; full_name: string }> } }>(url)
    const item = data.result?.items?.[0]
    if (!item) return null
    return { lat: item.point.lat, lon: item.point.lon, full_name: item.full_name }
  },

  async distanceMatrix(points: Array<{ lat: number; lon: number }>): Promise<MatrixResult> {
    const sources  = points.map((p, i) => ({ id: i, point: { lat: p.lat, lon: p.lon } }))
    const targets  = sources
    const body = { sources, targets, transport: 'car' }
    const url  = `${MATRIX_BASE}?key=${API_KEY}&version=2.0`
    const data = await fetchJson<{
      routes: Array<{ source_id: number; target_id: number; duration: number; distance: number; status: string }>
    }>(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    const n = points.length
    const rows: MatrixResult['rows'] = Array.from({ length: n }, () => Array(n).fill(null))
    for (const r of data.routes) {
      if (r.status === 'OK') {
        rows[r.source_id][r.target_id] = {
          duration_seconds: r.duration,
          distance_meters:  r.distance,
        }
      }
    }
    return { rows }
  },

  async getRoute(waypoints: Array<{ lat: number; lon: number }>): Promise<RouteSegment> {
    const points = waypoints.map(p => ({ type: 'walking', x: p.lon, y: p.lat }))
    const body   = { points, transport: 'car', output: 'summary' }
    const url    = `${DIRECTIONS_BASE}?key=${API_KEY}`
    const data   = await fetchJson<{
      result: Array<{ total_duration: number; total_distance: number; geometry: { selection: string } }>
    }>(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const r = data.result?.[0]
    if (!r) throw new Error('2GIS Directions: no route found')
    return {
      distance_meters:  r.total_distance,
      duration_seconds: r.total_duration,
      polyline:         r.geometry?.selection ?? '',
    }
  },
}
