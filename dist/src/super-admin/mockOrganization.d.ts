export type MockHoldingSeed = {
    key: string;
    code: string;
    name: string;
    isActive?: boolean;
};
export type MockDealershipSeed = {
    code: string;
    name: string;
    city: string;
    address: string;
    holdingKey?: string | null;
    isActive?: boolean;
};
export declare const MOCK_HOLDING_SEEDS: MockHoldingSeed[];
export declare const MOCK_DEALERSHIP_SEEDS: MockDealershipSeed[];
//# sourceMappingURL=mockOrganization.d.ts.map