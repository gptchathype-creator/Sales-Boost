import type { Request, Response } from 'express';
export declare function syncMockOrganization(): Promise<{
    holdingsCreated: number;
    dealershipsCreated: number;
    dealershipsUpdated: number;
}>;
export declare function handleListHoldings(req: Request, res: Response): Promise<void>;
export declare function handleListDealerships(req: Request, res: Response): Promise<void>;
export declare function handleCreateHolding(req: Request, res: Response): Promise<void>;
export declare function handleUpdateHolding(req: Request, res: Response): Promise<void>;
export declare function handleDeleteHolding(req: Request, res: Response): Promise<void>;
export declare function handleCreateDealership(req: Request, res: Response): Promise<void>;
export declare function handleUpdateDealership(req: Request, res: Response): Promise<void>;
export declare function handleDeleteDealership(req: Request, res: Response): Promise<void>;
export declare function handleSyncMockOrganization(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=organizationManagement.d.ts.map