import type { Account, AccountMembership, AccountPermissionTemplateAssignment, PermissionTemplate, TelegramLink, User } from '@prisma/client';
import { type AppRole, type PermissionKey, type PermissionScopeContext } from './permissions';
export declare const PLATFORM_SUPERADMIN: "platform_superadmin";
export declare const HOLDING_ADMIN: "holding_admin";
export declare const DEALERSHIP_ADMIN: "dealership_admin";
export declare const MANAGER: "manager";
export type AuthAccount = Account & {
    memberships: AccountMembership[];
    telegramLinks: TelegramLink[];
    permissionTemplateAssignments: Array<AccountPermissionTemplateAssignment & {
        template: PermissionTemplate;
    }>;
};
export type AuthContext = {
    account: AuthAccount | null;
    telegramUser: User | null;
    legacyTelegramAdmin: boolean;
};
type Scope = {
    holdingId: string;
    dealershipId?: never;
} | {
    dealershipId: string;
    holdingId?: never;
};
export declare function getAuthContextByAccountId(accountId: string): Promise<AuthContext>;
export declare function getAuthContextByTelegram(telegramId: string): Promise<AuthContext>;
export declare function hasRole(account: AuthAccount | null, role: AppRole): boolean;
export declare function hasPlatformSuperadmin(account: AuthAccount | null): boolean;
export declare function hasScopedRole(account: AuthAccount | null, role: AppRole, scope: Scope): boolean;
export declare function canAccessHolding(account: AuthAccount | null, holdingId: string): boolean;
export declare function canAccessDealership(account: AuthAccount | null, params: {
    dealershipId: string;
    holdingId?: string | null;
}): boolean;
export declare function canManageDealership(account: AuthAccount | null, params: {
    dealershipId: string;
    holdingId?: string | null;
}): boolean;
export declare function hasPermission(account: AuthAccount | null, permission: PermissionKey, scope?: PermissionScopeContext): boolean;
export declare function isAnyAdmin(context: AuthContext): boolean;
export {};
//# sourceMappingURL=rbac.d.ts.map