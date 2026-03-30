import type { Car } from '../data/carLoader';
export interface FactCheckResult {
    hasConflict: boolean;
    field?: 'year' | 'price_rub' | 'mileage_km';
    advertisedValue?: number;
    claimedValue?: number;
}
export declare function checkManagerFacts(managerText: string, car: Car): FactCheckResult;
//# sourceMappingURL=factCheck.d.ts.map