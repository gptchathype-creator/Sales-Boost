"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANAGER = exports.DEALERSHIP_ADMIN = exports.HOLDING_ADMIN = exports.PLATFORM_SUPERADMIN = void 0;
exports.getAuthContextByAccountId = getAuthContextByAccountId;
exports.getAuthContextByTelegram = getAuthContextByTelegram;
exports.hasRole = hasRole;
exports.hasPlatformSuperadmin = hasPlatformSuperadmin;
exports.hasScopedRole = hasScopedRole;
exports.canAccessHolding = canAccessHolding;
exports.canAccessDealership = canAccessDealership;
exports.canManageDealership = canManageDealership;
exports.hasPermission = hasPermission;
exports.isAnyAdmin = isAnyAdmin;
const db_1 = require("../db");
const utils_1 = require("../utils");
const permissions_1 = require("./permissions");
exports.PLATFORM_SUPERADMIN = permissions_1.APP_ROLES.platformSuperadmin;
exports.HOLDING_ADMIN = permissions_1.APP_ROLES.holdingAdmin;
exports.DEALERSHIP_ADMIN = permissions_1.APP_ROLES.dealershipAdmin;
exports.MANAGER = permissions_1.APP_ROLES.manager;
async function getAccountById(accountId) {
    return db_1.prisma.account.findUnique({
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
async function getAuthContextByAccountId(accountId) {
    const account = await getAccountById(accountId);
    return {
        account,
        telegramUser: null,
        legacyTelegramAdmin: false,
    };
}
async function getAuthContextByTelegram(telegramId) {
    const telegramUser = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    const telegramLink = await db_1.prisma.telegramLink.findUnique({
        where: { telegramId },
    });
    const accountId = telegramLink?.accountId ?? telegramUser?.accountId ?? null;
    const account = accountId ? await getAccountById(accountId) : null;
    return {
        account,
        telegramUser,
        legacyTelegramAdmin: (0, utils_1.isAdminById)(telegramId),
    };
}
function hasRole(account, role) {
    if (!account)
        return false;
    return account.memberships.some((membership) => membership.role === role);
}
function hasPlatformSuperadmin(account) {
    return hasRole(account, exports.PLATFORM_SUPERADMIN);
}
function hasScopedRole(account, role, scope) {
    if (!account)
        return false;
    if (hasPlatformSuperadmin(account))
        return true;
    if ('dealershipId' in scope) {
        return account.memberships.some((membership) => membership.role === role &&
            membership.dealershipId === scope.dealershipId);
    }
    return account.memberships.some((membership) => membership.role === role &&
        membership.holdingId === scope.holdingId);
}
function canAccessHolding(account, holdingId) {
    if (!account)
        return false;
    if (hasPlatformSuperadmin(account))
        return true;
    return hasScopedRole(account, exports.HOLDING_ADMIN, { holdingId });
}
function canAccessDealership(account, params) {
    if (!account)
        return false;
    if (hasPlatformSuperadmin(account))
        return true;
    if (hasScopedRole(account, exports.DEALERSHIP_ADMIN, { dealershipId: params.dealershipId }))
        return true;
    if (hasScopedRole(account, exports.MANAGER, { dealershipId: params.dealershipId }))
        return true;
    if (params.holdingId && hasScopedRole(account, exports.HOLDING_ADMIN, { holdingId: params.holdingId }))
        return true;
    return false;
}
function canManageDealership(account, params) {
    if (!account)
        return false;
    if (hasPlatformSuperadmin(account))
        return true;
    if (hasScopedRole(account, exports.DEALERSHIP_ADMIN, { dealershipId: params.dealershipId }))
        return true;
    if (params.holdingId && hasScopedRole(account, exports.HOLDING_ADMIN, { holdingId: params.holdingId }))
        return true;
    return false;
}
function hasPermission(account, permission, scope) {
    if (!account)
        return false;
    const templateGrants = account.permissionTemplateAssignments.some((assignment) => {
        try {
            const permissions = JSON.parse(assignment.template.permissionsJson || '[]');
            return permissions.includes(permission);
        }
        catch {
            return false;
        }
    });
    if (templateGrants)
        return true;
    return account.memberships.some((membership) => (0, permissions_1.membershipGrantsPermission)(membership, permission, scope));
}
function isAnyAdmin(context) {
    if (context.legacyTelegramAdmin)
        return true;
    if (!context.account)
        return false;
    return (hasRole(context.account, exports.PLATFORM_SUPERADMIN) ||
        hasRole(context.account, exports.HOLDING_ADMIN) ||
        hasRole(context.account, exports.DEALERSHIP_ADMIN));
}
//# sourceMappingURL=rbac.js.map