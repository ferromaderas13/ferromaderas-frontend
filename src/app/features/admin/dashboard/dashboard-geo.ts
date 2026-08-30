/** Silueta simplificada de Guatemala [lng, lat]. */
export const GT_OUTLINE: [number, number][] = [
  [-92.24, 14.54],
  [-92.11, 14.85],
  [-92.05, 15.2],
  [-91.85, 15.7],
  [-91.55, 16.15],
  [-91.15, 16.55],
  [-90.7, 16.95],
  [-90.48, 17.25],
  [-90.54, 17.82],
  [-89.15, 17.82],
  [-89.15, 17.0],
  [-89.22, 16.4],
  [-89.15, 15.9],
  [-88.85, 15.95],
  [-88.23, 15.88],
  [-88.35, 15.7],
  [-88.75, 15.65],
  [-89.15, 15.2],
  [-89.22, 14.7],
  [-89.35, 14.4],
  [-89.22, 14.05],
  [-89.15, 13.78],
  [-90.1, 13.74],
  [-90.7, 13.82],
  [-91.4, 14.12],
  [-92.11, 14.42],
  [-92.24, 14.54],
];

export const MAP_W = 360;
export const MAP_H = 430;
const MIN_LNG = -92.45;
const MAX_LNG = -88.05;
const MIN_LAT = 13.62;
const MAX_LAT = 17.95;
const PAD = 28;

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  amatitlan: { lat: 14.487, lng: -90.615 },
  'villa nueva': { lat: 14.526, lng: -90.588 },
  mixco: { lat: 14.633, lng: -90.606 },
  'guatemala city': { lat: 14.635, lng: -90.507 },
  guatemala: { lat: 14.635, lng: -90.507 },
  'ciudad de guatemala': { lat: 14.635, lng: -90.507 },
  chinautla: { lat: 14.703, lng: -90.499 },
  petapa: { lat: 14.502, lng: -90.562 },
  fraijanes: { lat: 14.465, lng: -90.441 },
  'santa catarina pinula': { lat: 14.569, lng: -90.496 },
  'san miguel petapa': { lat: 14.502, lng: -90.562 },
  'villa canales': { lat: 14.482, lng: -90.534 },
  palin: { lat: 14.411, lng: -90.699 },
  'san juan sacatepequez': { lat: 14.719, lng: -90.644 },
  'san pedro sacatepequez': { lat: 14.686, lng: -90.644 },
  'antigua guatemala': { lat: 14.561, lng: -90.734 },
  antigua: { lat: 14.561, lng: -90.734 },
  chimaltenango: { lat: 14.661, lng: -90.819 },
  escuintla: { lat: 14.305, lng: -90.785 },
  quetzaltenango: { lat: 14.835, lng: -91.518 },
  quezaltenango: { lat: 14.835, lng: -91.518 },
  xela: { lat: 14.835, lng: -91.518 },
  coban: { lat: 15.483, lng: -90.317 },
  'puerto barrios': { lat: 15.728, lng: -88.594 },
  zacapa: { lat: 14.972, lng: -89.531 },
  jalapa: { lat: 14.635, lng: -89.989 },
  jutiapa: { lat: 14.292, lng: -89.896 },
  retalhuleu: { lat: 14.536, lng: -91.678 },
  mazatenango: { lat: 14.534, lng: -91.503 },
  huehuetenango: { lat: 15.319, lng: -91.471 },
  'santa cruz del quiche': { lat: 15.031, lng: -91.149 },
  totonicapan: { lat: 14.912, lng: -91.361 },
  solola: { lat: 14.774, lng: -91.183 },
  panajachel: { lat: 14.736, lng: -91.16 },
  flores: { lat: 16.934, lng: -89.892 },
  'santa lucia cotzumalguapa': { lat: 14.333, lng: -91.024 },
  chiquimula: { lat: 14.8, lng: -89.546 },
  'san jose pinula': { lat: 14.546, lng: -90.418 },
  'san marcos': { lat: 14.964, lng: -91.795 },
};

const DEPT_COORDS: Record<string, { lat: number; lng: number }> = {
  guatemala: { lat: 14.635, lng: -90.507 },
  'alta verapaz': { lat: 15.57, lng: -90.37 },
  'baja verapaz': { lat: 15.09, lng: -90.44 },
  chimaltenango: { lat: 14.66, lng: -90.82 },
  chiquimula: { lat: 14.8, lng: -89.54 },
  'el progreso': { lat: 14.85, lng: -90.07 },
  escuintla: { lat: 14.3, lng: -90.79 },
  huehuetenango: { lat: 15.32, lng: -91.47 },
  izabal: { lat: 15.73, lng: -88.59 },
  jalapa: { lat: 14.63, lng: -89.99 },
  jutiapa: { lat: 14.29, lng: -89.9 },
  peten: { lat: 16.93, lng: -89.89 },
  quetzaltenango: { lat: 14.83, lng: -91.52 },
  quiche: { lat: 15.03, lng: -91.15 },
  retalhuleu: { lat: 14.54, lng: -91.68 },
  sacatepequez: { lat: 14.56, lng: -90.73 },
  'san marcos': { lat: 14.96, lng: -91.8 },
  'santa rosa': { lat: 14.15, lng: -90.32 },
  solola: { lat: 14.77, lng: -91.18 },
  suchitepequez: { lat: 14.53, lng: -91.5 },
  totonicapan: { lat: 14.91, lng: -91.36 },
  zacapa: { lat: 14.97, lng: -89.53 },
};

export interface VisitOrigin {
  pais: string;
  departamento: string;
  ciudad: string;
  visitas: number;
}

export interface MapMarker {
  key: string;
  label: string;
  detalle: string;
  visitas: number;
  x: number;
  y: number;
  r: number;
}

export function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isGuatemala(pais: string): boolean {
  const n = foldName(pais);
  return n === 'guatemala' || n === 'gt';
}

export function projectLngLat(lng: number, lat: number): { x: number; y: number } {
  const x = PAD + ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * (MAP_W - PAD * 2);
  const y = PAD + ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (MAP_H - PAD * 2);
  return { x, y };
}

export const SUCURSAL = {
  label: 'Ferromaderas',
  detalle: 'Sucursal · Amatitlán',
  ...projectLngLat(-90.615, 14.487),
};

export function guatemalaPath(): string {
  return (
    GT_OUTLINE.map(([lng, lat], i) => {
      const { x, y } = projectLngLat(lng, lat);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ') + ' Z'
  );
}

export function displayPlace(ciudad: string, departamento: string): string {
  const city = foldName(ciudad);
  if (!city || city === '(not set)' || city === 'not set') {
    return cleanRegion(departamento) || 'Sin ubicar';
  }
  if (city.endsWith(' department')) {
    return cleanRegion(ciudad.replace(/\s*department$/i, ''));
  }
  if (city === 'guatemala city' || city === 'guatemala') return 'Ciudad de Guatemala';
  return ciudad;
}

function cleanRegion(value: string): string {
  const folded = foldName(value);
  if (!folded || folded === '(not set)' || folded === 'not set') return '';
  if (folded === 'guatemala' || folded === 'guatemala department') return 'Dept. Guatemala';
  return value.replace(/\s*department$/i, '').trim();
}

const COUNTRY_ES: Record<string, string> = {
  'united states': 'Estados Unidos',
  'usa': 'Estados Unidos',
  netherlands: 'Países Bajos',
  mexico: 'México',
  'el salvador': 'El Salvador',
  honduras: 'Honduras',
  belize: 'Belice',
  spain: 'España',
  canada: 'Canadá',
};

function coordsFor(origin: VisitOrigin): { lat: number; lng: number } | null {
  const city = foldName(origin.ciudad);
  if (city && city !== '(not set)' && city !== 'not set' && CITY_COORDS[city]) {
    return CITY_COORDS[city];
  }
  const deptRaw = foldName(origin.departamento).replace(/ department$/, '');
  if (deptRaw && DEPT_COORDS[deptRaw]) return DEPT_COORDS[deptRaw];
  const cityDept = city.replace(/ department$/, '');
  if (cityDept && DEPT_COORDS[cityDept]) return DEPT_COORDS[cityDept];
  return null;
}

export function markersFromOrigins(origins: VisitOrigin[]): MapMarker[] {
  const grouped = new Map<string, MapMarker>();
  const gt = origins.filter((o) => isGuatemala(o.pais));
  const max = Math.max(1, ...gt.map((o) => o.visitas));

  for (const origin of gt) {
    const coords = coordsFor(origin);
    if (!coords) continue;
    const label = displayPlace(origin.ciudad, origin.departamento);
    const key = `${label}|${origin.departamento}`;
    const prev = grouped.get(key);
    const visitas = (prev?.visitas ?? 0) + origin.visitas;
    const { x, y } = projectLngLat(coords.lng, coords.lat);
    grouped.set(key, {
      key,
      label,
      detalle: origin.departamento && origin.departamento !== '(not set)'
        ? origin.departamento
        : 'Guatemala',
      visitas,
      x,
      y,
      r: 7 + (visitas / max) * 14,
    });
  }

  return [...grouped.values()].sort((a, b) => a.visitas - b.visitas);
}

export function rankGuatemala(origins: VisitOrigin[]): { label: string; visitas: number }[] {
  const map = new Map<string, number>();
  for (const origin of origins.filter((o) => isGuatemala(o.pais))) {
    const label = displayPlace(origin.ciudad, origin.departamento);
    map.set(label, (map.get(label) ?? 0) + origin.visitas);
  }
  return [...map.entries()]
    .map(([label, visitas]) => ({ label, visitas }))
    .sort((a, b) => b.visitas - a.visitas);
}

export function rankExtranjero(origins: VisitOrigin[]): { label: string; visitas: number }[] {
  const map = new Map<string, number>();
  for (const origin of origins.filter((o) => !isGuatemala(o.pais))) {
    const label = COUNTRY_ES[foldName(origin.pais)] || origin.pais || 'Otro país';
    map.set(label, (map.get(label) ?? 0) + origin.visitas);
  }
  return [...map.entries()]
    .map(([label, visitas]) => ({ label, visitas }))
    .sort((a, b) => b.visitas - a.visitas);
}
