export type DealershipSchedule = {
  id: string;
  name: string;
  city: string;
  workStartHour: number;
  workEndHour: number;
};

export const DEALERSHIP_DIRECTORY: DealershipSchedule[] = [
  { id: 'd1', name: 'Автосалон Север-1', city: 'Москва', workStartHour: 10, workEndHour: 19 },
  { id: 'd2', name: 'Автосалон Север-2', city: 'Москва', workStartHour: 10, workEndHour: 19 },
  { id: 'd3', name: 'Автосалон Север-СПб', city: 'Санкт-Петербург', workStartHour: 10, workEndHour: 20 },
  { id: 'd4', name: 'Drive Москва', city: 'Москва', workStartHour: 9, workEndHour: 19 },
  { id: 'd5', name: 'МоторСервис Центр', city: 'Казань', workStartHour: 10, workEndHour: 19 },
];

export function getDealershipDirectory(): DealershipSchedule[] {
  return DEALERSHIP_DIRECTORY;
}
