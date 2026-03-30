import { z } from 'zod';
declare const CarSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    price_rub: z.ZodNumber;
    brand: z.ZodString;
    model: z.ZodString;
    year: z.ZodNumber;
    mileage_km: z.ZodNumber;
    technical: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    description: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    deal_terms: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    location: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    title: z.ZodString;
    price_rub: z.ZodNumber;
    brand: z.ZodString;
    model: z.ZodString;
    year: z.ZodNumber;
    mileage_km: z.ZodNumber;
    technical: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    description: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    deal_terms: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    location: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    title: z.ZodString;
    price_rub: z.ZodNumber;
    brand: z.ZodString;
    model: z.ZodString;
    year: z.ZodNumber;
    mileage_km: z.ZodNumber;
    technical: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    description: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    deal_terms: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    location: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.ZodTypeAny, "passthrough">>;
export type Car = z.infer<typeof CarSchema>;
/**
 * Load and validate car data from JSON file.
 * Required fields: id, title, price_rub, brand, model, year, mileage_km, technical, description, deal_terms, location.
 */
export declare function loadCar(filePath?: string): Car;
export {};
//# sourceMappingURL=carLoader.d.ts.map