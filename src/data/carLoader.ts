import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

const CarSchema = z.object({
  id: z.string(),
  title: z.string(),
  price_rub: z.number(),
  brand: z.string(),
  model: z.string(),
  year: z.number(),
  mileage_km: z.number(),
  technical: z.record(z.unknown()),
  description: z.record(z.unknown()),
  deal_terms: z.record(z.unknown()),
  location: z.record(z.unknown()),
}).passthrough();

export type Car = z.infer<typeof CarSchema>;

const DEFAULT_CAR_PATH = path.join(process.cwd(), 'data', 'car.json');

/**
 * Load and validate car data from JSON file.
 * Required fields: id, title, price_rub, brand, model, year, mileage_km, technical, description, deal_terms, location.
 */
export function loadCar(filePath: string = DEFAULT_CAR_PATH): Car {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Car file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf-8');
  const data = JSON.parse(raw) as unknown;
  const result = CarSchema.safeParse(data);
  if (!result.success) {
    const msg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Invalid car.json: ${msg}`);
  }
  return result.data;
}
