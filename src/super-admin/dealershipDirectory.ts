import { MOCK_DEALERSHIP_SEEDS } from './mockOrganization';

export type DealershipSchedule = {
  id: string;
  name: string;
  city: string;
  workStartHour: number;
  workEndHour: number;
};

function resolveWorkingHours(city: string): { workStartHour: number; workEndHour: number } {
  if (city === 'Санкт-Петербург') return { workStartHour: 10, workEndHour: 20 };
  if (city === 'Москва') return { workStartHour: 9, workEndHour: 20 };
  return { workStartHour: 10, workEndHour: 19 };
}

export const DEALERSHIP_DIRECTORY: DealershipSchedule[] = MOCK_DEALERSHIP_SEEDS.map((seed) => ({
  id: seed.code,
  name: seed.name,
  city: seed.city,
  ...resolveWorkingHours(seed.city),
}));

export function getDealershipDirectory(): DealershipSchedule[] {
  return DEALERSHIP_DIRECTORY;
}
