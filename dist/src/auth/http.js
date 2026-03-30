"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAuthLogin = handleAuthLogin;
exports.handleAuthMe = handleAuthMe;
exports.adminApiAuthMiddleware = adminApiAuthMiddleware;
const db_1 = require("../db");
const config_1 = require("../config");
const password_1 = require("./password");
const token_1 = require("./token");
function tokenSecret() {
    return config_1.config.authTokenSecret || `${config_1.config.botToken}:salesboost-auth`;
}
function toFrontendRole(memberships) {
    const roles = memberships.map((membership) => membership.role);
    if (roles.includes('platform_superadmin'))
        return 'super';
    if (roles.includes('holding_admin'))
        return 'company';
    if (roles.includes('dealership_admin'))
        return 'dealer';
    return 'staff';
}
function toAllowedRoles(memberships) {
    const out = new Set();
    for (const membership of memberships) {
        if (membership.role === 'platform_superadmin')
            out.add('super');
        if (membership.role === 'holding_admin')
            out.add('company');
        if (membership.role === 'dealership_admin')
            out.add('dealer');
        if (membership.role === 'manager')
            out.add('staff');
    }
    if (out.size === 0)
        out.add('staff');
    return Array.from(out);
}
function accountToAuthPayload(account) {
    const templateAssignments = account.permissionTemplateAssignments;
    return {
        account: {
            id: account.id,
            email: account.email,
            displayName: account.displayName,
            status: account.status,
        },
        allowedRoles: toAllowedRoles(account.memberships),
        defaultRole: toFrontendRole(account.memberships),
        memberships: account.memberships.map((membership) => ({
            id: membership.id,
            role: membership.role,
            holdingId: membership.holdingId,
            dealershipId: membership.dealershipId,
        })),
        permissionTemplates: templateAssignments.map((assignment) => ({
            id: assignment.template.id,
            name: assignment.template.name,
            description: assignment.template.description,
            permissions: JSON.parse(assignment.template.permissionsJson || '[]'),
        })),
    };
}
async function getAccountForRequest(req) {
    const authHeader = req.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token)
        return null;
    const payload = (0, token_1.verifyAuthToken)(token, tokenSecret());
    if (!payload)
        return null;
    return db_1.prisma.account.findUnique({
        where: { id: payload.sub },
        include: {
            memberships: true,
            permissionTemplateAssignments: {
                include: {
                    template: true,
                },
            },
        },
    });
}
async function handleAuthLogin(req, res) {
    const body = (req.body || {});
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    if (!email || !password) {
        res.status(400).json({ error: 'Email и пароль обязательны.' });
        return;
    }
    const account = await db_1.prisma.account.findUnique({
        where: { email },
        include: {
            memberships: true,
            permissionTemplateAssignments: {
                include: {
                    template: true,
                },
            },
        },
    });
    if (!account || account.status !== 'active' || !(0, password_1.verifyPassword)(password, account.passwordHash)) {
        res.status(401).json({ error: 'Неверный email или пароль.' });
        return;
    }
    await db_1.prisma.account.update({
        where: { id: account.id },
        data: { lastLoginAt: new Date() },
    }).catch(() => { });
    const token = (0, token_1.createAuthToken)({ sub: account.id, email: account.email }, tokenSecret());
    res.json({
        token,
        ...accountToAuthPayload(account),
    });
}
async function handleAuthMe(req, res) {
    const account = await getAccountForRequest(req);
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    req.authAccount = account;
    res.json(accountToAuthPayload(account));
}
async function adminApiAuthMiddleware(req, res, next) {
    const account = await getAccountForRequest(req);
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    req.authAccount = account;
    next();
}
//# sourceMappingURL=http.js.map