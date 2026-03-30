"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRbacMeta = handleRbacMeta;
exports.handleListUsers = handleListUsers;
exports.handleCreateUser = handleCreateUser;
exports.handleUpdateUser = handleUpdateUser;
exports.handleDeleteUser = handleDeleteUser;
exports.handleListPermissionTemplates = handleListPermissionTemplates;
exports.handleCreatePermissionTemplate = handleCreatePermissionTemplate;
exports.handleUpdatePermissionTemplate = handleUpdatePermissionTemplate;
exports.handleDeletePermissionTemplate = handleDeletePermissionTemplate;
const db_1 = require("../db");
const password_1 = require("./password");
const permissions_1 = require("./permissions");
function isPlatformSuperadmin(account) {
    return account.memberships.some((membership) => membership.role === permissions_1.APP_ROLES.platformSuperadmin);
}
function isHoldingAdmin(account) {
    return account.memberships.some((membership) => membership.role === permissions_1.APP_ROLES.holdingAdmin);
}
function getHoldingIds(account) {
    return [...new Set(account.memberships.filter((membership) => membership.role === permissions_1.APP_ROLES.holdingAdmin && membership.holdingId).map((membership) => membership.holdingId))];
}
async function getAccessibleDealerships(account) {
    if (isPlatformSuperadmin(account)) {
        return db_1.prisma.dealership.findMany({
            include: { holding: true },
            orderBy: [{ holding: { name: 'asc' } }, { name: 'asc' }],
        });
    }
    const holdingIds = getHoldingIds(account);
    if (holdingIds.length === 0)
        return [];
    return db_1.prisma.dealership.findMany({
        where: { holdingId: { in: holdingIds } },
        include: { holding: true },
        orderBy: [{ holding: { name: 'asc' } }, { name: 'asc' }],
    });
}
async function getAccessibleHoldingIds(account) {
    if (isPlatformSuperadmin(account)) {
        const holdings = await db_1.prisma.holding.findMany({ select: { id: true } });
        return holdings.map((holding) => holding.id);
    }
    return getHoldingIds(account);
}
function parseMemberships(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((raw) => (raw && typeof raw === 'object' ? raw : null))
        .filter(Boolean)
        .map((raw) => ({
        role: String(raw.role || ''),
        holdingId: raw.holdingId != null ? String(raw.holdingId) : null,
        dealershipId: raw.dealershipId != null ? String(raw.dealershipId) : null,
    }))
        .filter((membership) => membership.role.length > 0);
}
function parseManagerProfiles(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((raw) => (raw && typeof raw === 'object' ? raw : null))
        .filter(Boolean)
        .map((raw) => ({
        fullName: String(raw.fullName || '').trim(),
        dealershipId: String(raw.dealershipId || '').trim(),
        email: raw.email != null ? String(raw.email).trim() : null,
        phone: raw.phone != null ? String(raw.phone).trim() : null,
        status: raw.status != null ? String(raw.status).trim() : 'active',
    }))
        .filter((profile) => profile.fullName && profile.dealershipId);
}
function parseTemplateIds(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value.map((item) => String(item)).filter(Boolean))];
}
function parsePermissionKeys(value) {
    if (!Array.isArray(value))
        return [];
    const values = value.map((item) => String(item)).filter((item) => permissions_1.ALL_PERMISSIONS.includes(item));
    return [...new Set(values)];
}
function membershipToScopeLabel(membership) {
    if (membership.role === permissions_1.APP_ROLES.platformSuperadmin)
        return 'Платформа';
    if (membership.holding?.name)
        return membership.holding.name;
    if (membership.dealership?.name)
        return membership.dealership.name;
    return 'Без scope';
}
function normalizeAccountResponse(account) {
    return {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        status: account.status,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastLoginAt: account.lastLoginAt,
        memberships: account.memberships.map((membership) => ({
            id: membership.id,
            role: membership.role,
            holdingId: membership.holdingId,
            holdingName: membership.holding?.name ?? membership.dealership?.holding?.name ?? null,
            dealershipId: membership.dealershipId,
            dealershipName: membership.dealership?.name ?? null,
            scopeLabel: membershipToScopeLabel(membership),
        })),
        managerProfiles: account.managerProfiles.map((profile) => ({
            id: profile.id,
            fullName: profile.fullName,
            email: profile.email,
            phone: profile.phone,
            status: profile.status,
            dealershipId: profile.dealershipId,
            dealershipName: profile.dealership.name,
            holdingId: profile.dealership.holdingId,
            holdingName: profile.dealership.holding?.name ?? null,
        })),
        permissionTemplates: account.permissionTemplateAssignments.map((assignment) => ({
            id: assignment.template.id,
            name: assignment.template.name,
            description: assignment.template.description,
            permissions: JSON.parse(assignment.template.permissionsJson || '[]'),
        })),
    };
}
async function assertMembershipsAllowed(account, memberships, templateIds) {
    if (isPlatformSuperadmin(account))
        return;
    if (!isHoldingAdmin(account))
        throw new Error('Недостаточно прав для управления пользователями.');
    if (templateIds.length > 0)
        throw new Error('Шаблоны прав может назначать только суперадмин.');
    const dealerships = await getAccessibleDealerships(account);
    const dealershipIds = new Set(dealerships.map((dealership) => dealership.id));
    for (const membership of memberships) {
        if (membership.role !== permissions_1.APP_ROLES.manager) {
            throw new Error('Руководитель холдинга может создавать и редактировать только менеджеров.');
        }
        if (!membership.dealershipId || !dealershipIds.has(membership.dealershipId)) {
            throw new Error('Нельзя назначить менеджера вне автосалонов вашего холдинга.');
        }
    }
}
async function assertManagerProfilesAllowed(account, profiles) {
    if (isPlatformSuperadmin(account))
        return;
    if (!isHoldingAdmin(account))
        throw new Error('Недостаточно прав для управления пользователями.');
    const dealerships = await getAccessibleDealerships(account);
    const dealershipIds = new Set(dealerships.map((dealership) => dealership.id));
    for (const profile of profiles) {
        if (!dealershipIds.has(profile.dealershipId)) {
            throw new Error('Нельзя редактировать менеджеров вне автосалонов вашего холдинга.');
        }
    }
}
async function assertAccountInScope(account, targetAccountId) {
    if (isPlatformSuperadmin(account))
        return;
    if (!isHoldingAdmin(account))
        throw new Error('Недостаточно прав для управления пользователями.');
    const holdingIds = getHoldingIds(account);
    const target = await db_1.prisma.account.findUnique({
        where: { id: targetAccountId },
        include: {
            memberships: {
                include: {
                    dealership: true,
                },
            },
            managerProfiles: {
                include: {
                    dealership: true,
                },
            },
        },
    });
    if (!target)
        throw new Error('Пользователь не найден.');
    const inScope = target.memberships.some((membership) => membership.role === permissions_1.APP_ROLES.manager &&
        ((membership.dealership?.holdingId && holdingIds.includes(membership.dealership.holdingId)) || false)) || target.managerProfiles.some((profile) => !!profile.dealership.holdingId && holdingIds.includes(profile.dealership.holdingId));
    if (!inScope) {
        throw new Error('Нельзя управлять пользователем вне автосалонов вашего холдинга.');
    }
}
async function handleRbacMeta(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    const [holdings, dealerships, templates] = await Promise.all([
        isPlatformSuperadmin(account)
            ? db_1.prisma.holding.findMany({ orderBy: { name: 'asc' } })
            : db_1.prisma.holding.findMany({ where: { id: { in: getHoldingIds(account) } }, orderBy: { name: 'asc' } }),
        getAccessibleDealerships(account),
        isPlatformSuperadmin(account)
            ? db_1.prisma.permissionTemplate.findMany({ orderBy: { name: 'asc' } })
            : Promise.resolve([]),
    ]);
    res.json({
        roles: Object.values(permissions_1.APP_ROLES),
        permissions: permissions_1.PERMISSION_DEFINITIONS,
        holdings: holdings.map((holding) => ({ id: holding.id, name: holding.name })),
        dealerships: dealerships.map((dealership) => ({
            id: dealership.id,
            name: dealership.name,
            holdingId: dealership.holdingId ?? null,
            holdingName: dealership.holding?.name ?? null,
        })),
        permissionTemplates: templates.map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description,
            permissions: JSON.parse(template.permissionsJson || '[]'),
            isSystem: template.isSystem,
        })),
        canManageTemplates: isPlatformSuperadmin(account),
    });
}
async function handleListUsers(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    const search = String(req.query.search || '').trim().toLowerCase();
    const holdingIds = getHoldingIds(account);
    const where = isPlatformSuperadmin(account)
        ? {}
        : {
            OR: [
                {
                    memberships: {
                        some: {
                            role: permissions_1.APP_ROLES.manager,
                            dealership: {
                                holdingId: { in: holdingIds },
                            },
                        },
                    },
                },
                {
                    managerProfiles: {
                        some: {
                            dealership: {
                                holdingId: { in: holdingIds },
                            },
                        },
                    },
                },
            ],
        };
    const accounts = await db_1.prisma.account.findMany({
        where,
        include: {
            memberships: {
                include: {
                    holding: true,
                    dealership: {
                        include: {
                            holding: true,
                        },
                    },
                },
            },
            managerProfiles: {
                include: {
                    dealership: {
                        include: {
                            holding: true,
                        },
                    },
                },
            },
            permissionTemplateAssignments: {
                include: {
                    template: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    const filtered = search
        ? accounts.filter((item) => {
            const haystack = [
                item.email,
                item.displayName || '',
                ...item.managerProfiles.map((profile) => profile.fullName),
                ...item.memberships.map((membership) => membership.dealership?.name || membership.holding?.name || ''),
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(search);
        })
        : accounts;
    res.json({
        items: filtered.map(normalizeAccountResponse),
        canManageTemplates: isPlatformSuperadmin(account),
    });
}
async function handleCreateUser(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    const body = (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim() || null;
    const status = String(body.status || 'active').trim() || 'active';
    const memberships = parseMemberships(body.memberships);
    const managerProfiles = parseManagerProfiles(body.managerProfiles);
    const templateIds = parseTemplateIds(body.templateIds);
    if (!email || !password) {
        res.status(400).json({ error: 'Email и пароль обязательны.' });
        return;
    }
    if (memberships.length === 0) {
        res.status(400).json({ error: 'Нужно назначить хотя бы одну роль.' });
        return;
    }
    try {
        await assertMembershipsAllowed(account, memberships, templateIds);
        await assertManagerProfilesAllowed(account, managerProfiles);
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
        return;
    }
    try {
        const created = await db_1.prisma.account.create({
            data: {
                email,
                passwordHash: (0, password_1.hashPassword)(password),
                displayName,
                status,
                memberships: {
                    create: memberships.map((membership) => ({
                        role: membership.role,
                        holdingId: membership.holdingId ?? null,
                        dealershipId: membership.dealershipId ?? null,
                    })),
                },
                managerProfiles: managerProfiles.length
                    ? {
                        create: managerProfiles.map((profile) => ({
                            fullName: profile.fullName,
                            dealershipId: profile.dealershipId,
                            email: profile.email || null,
                            phone: profile.phone || null,
                            status: profile.status || 'active',
                        })),
                    }
                    : undefined,
                permissionTemplateAssignments: isPlatformSuperadmin(account) && templateIds.length
                    ? {
                        create: templateIds.map((templateId) => ({
                            templateId,
                        })),
                    }
                    : undefined,
            },
            include: {
                memberships: {
                    include: {
                        holding: true,
                        dealership: {
                            include: {
                                holding: true,
                            },
                        },
                    },
                },
                managerProfiles: {
                    include: {
                        dealership: {
                            include: {
                                holding: true,
                            },
                        },
                    },
                },
                permissionTemplateAssignments: {
                    include: {
                        template: true,
                    },
                },
            },
        });
        res.status(201).json({ item: normalizeAccountResponse(created) });
    }
    catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Не удалось создать пользователя.' });
    }
}
async function handleUpdateUser(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    const accountId = String(req.params.accountId || '').trim();
    if (!accountId) {
        res.status(400).json({ error: 'Некорректный accountId.' });
        return;
    }
    try {
        await assertAccountInScope(account, accountId);
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
        return;
    }
    const body = (req.body || {});
    const email = body.email != null ? String(body.email).trim().toLowerCase() : undefined;
    const password = body.password != null ? String(body.password) : undefined;
    const displayName = body.displayName != null ? String(body.displayName).trim() || null : undefined;
    const status = body.status != null ? String(body.status).trim() : undefined;
    const memberships = body.memberships != null ? parseMemberships(body.memberships) : undefined;
    const managerProfiles = body.managerProfiles != null ? parseManagerProfiles(body.managerProfiles) : undefined;
    const templateIds = body.templateIds != null ? parseTemplateIds(body.templateIds) : undefined;
    try {
        if (memberships)
            await assertMembershipsAllowed(account, memberships, templateIds || []);
        if (managerProfiles)
            await assertManagerProfilesAllowed(account, managerProfiles);
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
        return;
    }
    try {
        await db_1.prisma.$transaction(async (tx) => {
            await tx.account.update({
                where: { id: accountId },
                data: {
                    email,
                    displayName,
                    status,
                    ...(password ? { passwordHash: (0, password_1.hashPassword)(password) } : {}),
                },
            });
            if (memberships) {
                await tx.accountMembership.deleteMany({ where: { accountId } });
                if (memberships.length > 0) {
                    await tx.accountMembership.createMany({
                        data: memberships.map((membership) => ({
                            accountId,
                            role: membership.role,
                            holdingId: membership.holdingId ?? null,
                            dealershipId: membership.dealershipId ?? null,
                        })),
                    });
                }
            }
            if (managerProfiles) {
                await tx.managerProfile.deleteMany({ where: { accountId } });
                if (managerProfiles.length > 0) {
                    await tx.managerProfile.createMany({
                        data: managerProfiles.map((profile) => ({
                            accountId,
                            fullName: profile.fullName,
                            dealershipId: profile.dealershipId,
                            email: profile.email || null,
                            phone: profile.phone || null,
                            status: profile.status || 'active',
                        })),
                    });
                }
            }
            if (templateIds && isPlatformSuperadmin(account)) {
                await tx.accountPermissionTemplateAssignment.deleteMany({ where: { accountId } });
                if (templateIds.length > 0) {
                    await tx.accountPermissionTemplateAssignment.createMany({
                        data: templateIds.map((templateId) => ({
                            accountId,
                            templateId,
                        })),
                    });
                }
            }
        });
        const updated = await db_1.prisma.account.findUnique({
            where: { id: accountId },
            include: {
                memberships: {
                    include: {
                        holding: true,
                        dealership: {
                            include: {
                                holding: true,
                            },
                        },
                    },
                },
                managerProfiles: {
                    include: {
                        dealership: {
                            include: {
                                holding: true,
                            },
                        },
                    },
                },
                permissionTemplateAssignments: {
                    include: {
                        template: true,
                    },
                },
            },
        });
        res.json({ item: updated ? normalizeAccountResponse(updated) : null });
    }
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Не удалось обновить пользователя.' });
    }
}
async function handleDeleteUser(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    const accountId = String(req.params.accountId || '').trim();
    if (!accountId) {
        res.status(400).json({ error: 'Некорректный accountId.' });
        return;
    }
    if (account.id === accountId) {
        res.status(400).json({ error: 'Нельзя удалить собственную учётную запись.' });
        return;
    }
    try {
        await assertAccountInScope(account, accountId);
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
        return;
    }
    try {
        await db_1.prisma.account.delete({
            where: { id: accountId },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Не удалось удалить пользователя.' });
    }
}
function assertSuperadmin(account) {
    if (!isPlatformSuperadmin(account)) {
        throw new Error('Доступно только суперадмину.');
    }
}
async function handleListPermissionTemplates(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    try {
        assertSuperadmin(account);
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
        return;
    }
    const templates = await db_1.prisma.permissionTemplate.findMany({
        include: {
            assignments: true,
        },
        orderBy: { name: 'asc' },
    });
    res.json({
        items: templates.map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description,
            permissions: JSON.parse(template.permissionsJson || '[]'),
            assignedAccountsCount: template.assignments.length,
            isSystem: template.isSystem,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
        })),
    });
}
async function handleCreatePermissionTemplate(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    try {
        assertSuperadmin(account);
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
        return;
    }
    const body = (req.body || {});
    const name = String(body.name || '').trim();
    const description = body.description != null ? String(body.description).trim() : null;
    const permissions = parsePermissionKeys(body.permissions);
    if (!name) {
        res.status(400).json({ error: 'Название шаблона обязательно.' });
        return;
    }
    const template = await db_1.prisma.permissionTemplate.create({
        data: {
            name,
            description,
            permissionsJson: JSON.stringify(permissions),
            createdByAccountId: account.id,
        },
    });
    res.status(201).json({
        item: {
            id: template.id,
            name: template.name,
            description: template.description,
            permissions,
            assignedAccountsCount: 0,
            isSystem: template.isSystem,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
        },
    });
}
async function handleUpdatePermissionTemplate(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    try {
        assertSuperadmin(account);
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
        return;
    }
    const templateId = String(req.params.templateId || '').trim();
    const body = (req.body || {});
    const name = body.name != null ? String(body.name).trim() : undefined;
    const description = body.description != null ? String(body.description).trim() : undefined;
    const permissions = body.permissions != null ? parsePermissionKeys(body.permissions) : undefined;
    const template = await db_1.prisma.permissionTemplate.update({
        where: { id: templateId },
        data: {
            name,
            description,
            permissionsJson: permissions ? JSON.stringify(permissions) : undefined,
        },
        include: {
            assignments: true,
        },
    });
    res.json({
        item: {
            id: template.id,
            name: template.name,
            description: template.description,
            permissions: JSON.parse(template.permissionsJson || '[]'),
            assignedAccountsCount: template.assignments.length,
            isSystem: template.isSystem,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
        },
    });
}
async function handleDeletePermissionTemplate(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    try {
        assertSuperadmin(account);
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
        return;
    }
    const templateId = String(req.params.templateId || '').trim();
    if (!templateId) {
        res.status(400).json({ error: 'Некорректный templateId.' });
        return;
    }
    try {
        await db_1.prisma.permissionTemplate.delete({
            where: { id: templateId },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete permission template error:', error);
        res.status(500).json({ error: 'Не удалось удалить шаблон прав.' });
    }
}
//# sourceMappingURL=userManagement.js.map