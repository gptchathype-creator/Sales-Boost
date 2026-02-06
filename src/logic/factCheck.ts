import type { Car } from '../data/carLoader';

export interface FactCheckResult {
  hasConflict: boolean;
  field?: 'year' | 'price_rub' | 'mileage_km';
  advertisedValue?: number;
  claimedValue?: number;
}

const YEAR_RE = /(?:год|года|г\.?)\s*(\d{4})/i;
const PRICE_RE = /(\d[\d\s]{3,})\s*(?:₽|руб|руб\.?)/i;
const MILEAGE_RE = /(\d[\d\s]{3,})\s*(?:км|километр)/i;

function parseNumber(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s+/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export function checkManagerFacts(managerText: string, car: Car): FactCheckResult {
  const text = managerText.toLowerCase();

  // Year
  const yMatch = managerText.match(YEAR_RE);
  if (yMatch) {
    const claimed = parseNumber(yMatch[1]);
    if (claimed && claimed !== car.year) {
      return {
        hasConflict: true,
        field: 'year',
        advertisedValue: car.year,
        claimedValue: claimed,
      };
    }
  }

  // Price
  const pMatch = managerText.match(PRICE_RE);
  if (pMatch) {
    const claimed = parseNumber(pMatch[1]);
    if (claimed && Math.abs(claimed - car.price_rub) > car.price_rub * 0.05) {
      // заметное расхождение (>5%)
      return {
        hasConflict: true,
        field: 'price_rub',
        advertisedValue: car.price_rub,
        claimedValue: claimed,
      };
    }
  }

  // Mileage
  const mMatch = managerText.match(MILEAGE_RE);
  if (mMatch) {
    const claimed = parseNumber(mMatch[1]);
    if (claimed && Math.abs(claimed - car.mileage_km) > car.mileage_km * 0.1) {
      return {
        hasConflict: true,
        field: 'mileage_km',
        advertisedValue: car.mileage_km,
        claimedValue: claimed,
      };
    }
  }

  return { hasConflict: false };
}

