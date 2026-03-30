import type {
  Account,
  AccountMembership,
  AccountPermissionTemplateAssignment,
  PermissionTemplate,
  TelegramLink,
  User,
} from '@prisma/client';
import { prisma } from '../db';
import { isAdminById } from '../utils';
import {
  APP_ROLES,
  membershipGrantsPermission,
  type AppRole,
  type PermissionKey,
  type PermissionScopeContext,
} from './permissions';

export const PLATFORM_SUPERADMIN = APP_ROLES.platformSuperadmin;
export const HOLDING_ADMIN = APP_ROLES.holdingAdmin;
export const DEALERSHIP_ADMIN = APP_ROLES.dealershipAdmin;
export const MANAGER = APP_ROLES.manager;

export type AuthAccount = Account & {
  memberships: AccountMembership[];
  telegramLinks: TelegramLink[];
  permissionTemplateAssignments: Array<
    AccountPermissionTemplateAssignment & { template: PermissionTemplate }
  >;
};

export type AuthContext = {
  account: AuthAccount | null;
  telegramUser: User | null;
  legacyTelegramAdmin: boolean;
};

type Scope =
  | { holdingId: string; dealershipId?: never }
  | { dealershipId: string; holdingId?: never };

async function getAccountById(accountId: string): Promise<AuthAccount | null> {
  return prisma.account.findUnique({
    where: { id: accountId },
    include: {
      memberships: true,
      telegramLinks: true,
      permissionTemplateAssignments: {
        include: {
          template: true,
        },
      },
    },
  });
}

export async function getAuthContextByAccountId(accountId: string): Promise<AuthContext> {
  const account = await getAccountById(accountId);
  return {
    account,
    telegramUser: null,
    legacyTelegramAdmin: false,
  };
}

export async function getAuthContextByTelegram(telegramId: string): Promise<AuthContext> {
  const telegramUser = await prisma.user.findUnique({
    where: { telegramId },
  });

  const telegramLink = await prisma.telegramLink.findUnique({
    where: { telegramId },
  });

  const accountId = telegramLink?.accountId ?? telegramUser?.accountId ?? null;
  const account = accountId ? await getAccountById(accountId) : null;

  return {
    account,
    telegramUser,
    legacyTelegramAdmin: isAdminById(telegramId),
  };
}

export function hasRole(account: AuthAccount | null, role: AppRole): boolean {
  if (!account) return false;
  return account.memberships.some((membership) => membership.role === role);
}

export function hasPlatformSuperadmin(account: AuthAccount | null): boolean {
  return hasRole(account, PLATFORM_SUPERADMIN);
}

export function hasScopedRole(account: AuthAccount | null, role: AppRole, scope: Scope): boolean {
  if (!account) return false;
  if (hasPlatformSuperadmin(account)) return true;

  if ('dealershipId' in scope) {
    return account.memberships.some(
      (membership) =>
        membership.role === role &&
        membership.dealershipId === scope.dealershipId,
    );
  }

  return account.memberships.some(
    (membership) =>
      membership.role === role &&
      membership.holdingId === scope.holdingId,
  );
}

export function canAccessHolding(account: AuthAccount | null, holdingId: string): boolean {
  if (!account) return false;
  if (hasPlatformSuperadmin(account)) return true;
  return hasScopedRole(account, HOLDING_ADMIN, { holdingId });
}

export function canAccessDealership(
  account: AuthAccount | null,
  params: { dealershipId: string; holdingId?: string | null },
): boolean {
  if (!account) return false;
  if (hasPlatformSuperadmin(account)) return true;
  if (hasScopedRole(account, DEALERSHIP_ADMIN, { dealershipId: params.dealershipId })) return true;
  if (hasScopedRole(account, MANAGER, { dealershipId: params.dealershipId })) return true;
  if (params.holdingId && hasScopedRole(account, HOLDING_ADMIN, { holdingId: params.holdingId })) return true;
  return false;
}

export function canManageDealership(
  account: AuthAccount | null,
  params: { dealershipId: string; holdingId?: string | null },
): boolean {
  if (!account) return false;
  if (hasPlatformSuperadmin(account)) return true;
  if (hasScopedRole(account, DEALERSHIP_ADMIN, { dealershipId: params.dealershipId })) return true;
  if (params.holdingId && hasScopedRole(account, HOLDING_ADMIN, { holdingId: params.holdingId })) return true;
  return false;
}

export function hasPermission(
  account: AuthAccount | null,
  permission: PermissionKey,
  scope?: PermissionScopeContext,
): boolean {
  if (!account) return false;
  const templateGrants = account.permissionTemplateAssignments.some((assignment) => {
    try {
      const permissions = JSON.parse(assignment.template.permissionsJson || '[]') as string[];
      return permissions.includes(permission);
    } catch {
      return false;
    }
  });
  if (templateGrants) return true;
  return account.memberships.some((membership) =>
    membershipGrantsPermission(membership, permission, scope),
  );
}

export function isAnyAdmin(context: AuthContext): boolean {
  if (context.legacyTelegramAdmin) return true;
  if (!context.account) return false;
  return (
    hasRole(context.account, PLATFORM_SUPERADMIN) ||
    hasRole(context.account, HOLDING_ADMIN) ||
    hasRole(context.account, DEALERSHIP_ADMIN)
  );
}
