import { getTestNumbers } from './callHistory';
import { getDealershipDirectory } from '../super-admin/dealershipDirectory';

export type DealershipCallTarget = {
  dealershipId: string;
  dealershipName: string;
  city: string;
  workStartHour: number;
  workEndHour: number;
  phone: string;
};

export type CallSourceMode = 'mock' | 'real';

function normalizePhone(v: string): string {
  const digits = String(v || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function getCallSourceMode(): CallSourceMode {
  const raw = String(process.env.CALL_SOURCE_MODE || 'mock').trim().toLowerCase();
  return raw === 'real' ? 'real' : 'mock';
}

function buildMockTargets(): DealershipCallTarget[] {
  const dealerships = getDealershipDirectory();
  const numbers = getTestNumbers();
  if (numbers.length === 0) return [];
  let idx = 0;
  return dealerships.map((d) => {
    const phone = normalizePhone(numbers[idx % numbers.length]);
    idx += 1;
    return {
      dealershipId: d.id,
      dealershipName: d.name,
      city: d.city,
      workStartHour: d.workStartHour,
      workEndHour: d.workEndHour,
      phone,
    };
  });
}

function buildRealTargets(): DealershipCallTarget[] {
  // Real source is intentionally disabled for now.
  // We'll switch to DB/CRM-backed dealerships when real entities are added.
  return [];
}

export function listDealershipCallTargets(): DealershipCallTarget[] {
  const mode = getCallSourceMode();
  if (mode === 'real') return buildRealTargets();
  return buildMockTargets();
}

export function getCallSourceInfo(): {
  mode: CallSourceMode;
  targetsAvailable: number;
  usingMockFallback: boolean;
} {
  const mode = getCallSourceMode();
  const targets = listDealershipCallTargets();
  return {
    mode,
    targetsAvailable: targets.length,
    usingMockFallback: mode !== 'real',
  };
}
