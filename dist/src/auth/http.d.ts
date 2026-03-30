import type { NextFunction, Request, Response } from 'express';
export type FrontendRole = 'super' | 'company' | 'dealer' | 'staff';
export type AuthenticatedAccount = Awaited<ReturnType<typeof getAccountForRequest>>;
type AccountWithMemberships = NonNullable<AuthenticatedAccount>;
declare function getAccountForRequest(req: Request): Promise<({
    memberships: {
        id: string;
        role: string;
        accountId: string;
        createdAt: Date;
        dealershipId: string | null;
        updatedAt: Date;
        holdingId: string | null;
    }[];
    permissionTemplateAssignments: ({
        template: {
            name: string;
            id: string;
            createdAt: Date;
            description: string | null;
            updatedAt: Date;
            permissionsJson: string;
            isSystem: boolean;
            createdByAccountId: string | null;
        };
    } & {
        id: string;
        accountId: string;
        createdAt: Date;
        templateId: string;
    })[];
} & {
    status: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    passwordHash: string;
    displayName: string | null;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
}) | null>;
declare global {
    namespace Express {
        interface Request {
            authAccount?: AccountWithMemberships | null;
        }
    }
}
export declare function handleAuthLogin(req: Request, res: Response): Promise<void>;
export declare function handleAuthMe(req: Request, res: Response): Promise<void>;
export declare function adminApiAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
export {};
//# sourceMappingURL=http.d.ts.map