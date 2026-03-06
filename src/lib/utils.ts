import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateGridId(lat: number, lon: number, gridSizeM: number): string {
  // Simple approximation: 1 degree latitude is ~111km
  // This is a rough grid for privacy purposes
  const latDegreeM = 111320;
  const lonDegreeM = 40075000 * Math.cos((lat * Math.PI) / 180) / 360;

  const gx = Math.floor((lon * lonDegreeM) / gridSizeM);
  const gy = Math.floor((lat * latDegreeM) / gridSizeM);

  return `g_${gridSizeM}m_${gx}_${gy}`;
}

export function normalizeSpecies(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
