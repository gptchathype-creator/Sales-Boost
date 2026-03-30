export type DealershipCallTarget = {
    dealershipId: string;
    dealershipName: string;
    city: string;
    workStartHour: number;
    workEndHour: number;
    phone: string;
};
export type CallSourceMode = 'mock' | 'real';
export declare function listDealershipCallTargets(): DealershipCallTarget[];
export declare function getCallSourceInfo(): {
    mode: CallSourceMode;
    targetsAvailable: number;
    usingMockFallback: boolean;
};
//# sourceMappingURL=dealershipCallSource.d.ts.map