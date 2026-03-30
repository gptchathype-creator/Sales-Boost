"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncMockOrganization = syncMockOrganization;
exports.handleListHoldings = handleListHoldings;
exports.handleListDealerships = handleListDealerships;
exports.handleCreateHolding = handleCreateHolding;
exports.handleUpdateHolding = handleUpdateHolding;
exports.handleDeleteHolding = handleDeleteHolding;
exports.handleCreateDealership = handleCreateDealership;
exports.handleUpdateDealership = handleUpdateDealership;
exports.handleDeleteDealership = handleDeleteDealership;
exports.handleSyncMockOrganization = handleSyncMockOrganization;
const db_1 = require("../db");
const mockOrganization_1 = require("../super-admin/mockOrganization");
const permissions_1 = require("./permissions");
function isPlatformSuperadmin(account) {
    return account.memberships.some((membership) => membership.role === permissions_1.APP_ROLES.platformSuperadmin);
}
function assertSuperadmin(account) {
    if (!isPlatformSuperadmin(account)) {
        throw new Error('Доступно только суперадмину.');
    }
}
function isHoldingAdmin(account) {
    return account.memberships.some((membership) => membership.role === permissions_1.APP_ROLES.holdingAdmin);
}
function isDealershipAdmin(account) {
    return account.memberships.some((membership) => membership.role === permissions_1.APP_ROLES.dealershipAdmin);
}
function getHoldingIds(account) {
    return [...new Set(account.memberships
            .filter((membership) => membership.role === permissions_1.APP_ROLES.holdingAdmin && membership.holdingId)
            .map((membership) => membership.holdingId))];
}
function getDealershipIds(account) {
    return [...new Set(account.memberships
            .filter((membership) => membership.role === permissions_1.APP_ROLES.dealershipAdmin && membership.dealershipId)
            .map((membership) => membership.dealershipId))];
}
function canManageDealershipForAccount(account, params) {
    if (isPlatformSuperadmin(account))
        return true;
    if (getDealershipIds(account).includes(params.dealershipId))
        return true;
    if (params.holdingId && getHoldingIds(account).includes(params.holdingId))
        return true;
    return false;
}
function normalizeHoldingResponse(holding) {
    return {
        id: holding.id,
        name: holding.name,
        code: holding.code,
        isActive: holding.isActive,
        createdAt: holding.createdAt,
        updatedAt: holding.updatedAt,
        dealershipsCount: holding.dealerships.length,
        dealerships: holding.dealerships.map((dealership) => ({
            id: dealership.id,
            name: dealership.name,
            code: dealership.code,
            city: dealership.city,
            address: dealership.address,
            isActive: dealership.isActive,
            holdingId: dealership.holdingId,
        })),
    };
}
function normalizeDealershipResponse(dealership) {
    return {
        id: dealership.id,
        name: dealership.name,
        code: dealership.code,
        city: dealership.city,
        address: dealership.address,
        isActive: dealership.isActive,
        createdAt: dealership.createdAt,
        updatedAt: dealership.updatedAt,
        holdingId: dealership.holdingId,
        holdingName: dealership.holding?.name ?? null,
        managersCount: dealership._count.managerProfiles,
    };
}
function parseString(value) {
    const parsed = String(value ?? '').trim();
    return parsed ? parsed : null;
}
function parseBoolean(value, fallback) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        if (value === 'true' || value === '1')
            return true;
        if (value === 'false' || value === '0')
            return false;
    }
    return fallback;
}
function parseDealershipIds(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
}
async function getHoldingsSnapshot() {
    return db_1.prisma.holding.findMany({
        include: {
            dealerships: {
                orderBy: [{ city: 'asc' }, { name: 'asc' }],
            },
        },
        orderBy: { name: 'asc' },
    });
}
async function getDealershipsSnapshot() {
    return db_1.prisma.dealership.findMany({
        include: {
            holding: true,
            _count: {
                select: { managerProfiles: true },
            },
        },
        orderBy: [{ city: 'asc' }, { name: 'asc' }],
    });
}
async function syncMockOrganization() {
    let holdingsCreated = 0;
    let dealershipsCreated = 0;
    let dealershipsUpdated = 0;
    await db_1.prisma.$transaction(async (tx) => {
        const holdingByKey = new Map();
        for (const seed of mockOrganization_1.MOCK_HOLDING_SEEDS) {
            const existing = await tx.holding.findFirst({
                where: {
                    OR: [{ code: seed.code }, { name: seed.name }],
                },
            });
            if (existing) {
                const updated = await tx.holding.update({
                    where: { id: existing.id },
                    data: {
                        name: seed.name,
                        code: seed.code,
                        isActive: seed.isActive ?? true,
                    },
                });
                holdingByKey.set(seed.key, updated.id);
            }
            else {
                const created = await tx.holding.create({
                    data: {
                        name: seed.name,
                        code: seed.code,
                        isActive: seed.isActive ?? true,
                    },
                });
                holdingsCreated += 1;
                holdingByKey.set(seed.key, created.id);
            }
        }
        for (const seed of mockOrganization_1.MOCK_DEALERSHIP_SEEDS) {
            const holdingId = seed.holdingKey ? holdingByKey.get(seed.holdingKey) ?? null : null;
            const existing = await tx.dealership.findFirst({
                where: {
                    OR: [{ code: seed.code }, { name: seed.name, city: seed.city }],
                },
            });
            if (existing) {
                await tx.dealership.update({
                    where: { id: existing.id },
                    data: {
                        name: seed.name,
                        code: seed.code,
                        city: seed.city,
                        address: seed.address,
                        holdingId,
                        isActive: seed.isActive ?? true,
                    },
                });
                dealershipsUpdated += 1;
            }
            else {
                await tx.dealership.create({
                    data: {
                        name: seed.name,
                        code: seed.code,
                        city: seed.city,
                        address: seed.address,
                        holdingId,
                        isActive: seed.isActive ?? true,
                    },
                });
                dealershipsCreated += 1;
            }
        }
    });
    return { holdingsCreated, dealershipsCreated, dealershipsUpdated };
}
async function handleListHoldings(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    try {
        let items;
        if (isPlatformSuperadmin(account)) {
            items = await getHoldingsSnapshot();
        }
        else if (isHoldingAdmin(account)) {
            items = await db_1.prisma.holding.findMany({
                where: { id: { in: getHoldingIds(account) } },
                include: {
                    dealerships: {
                        orderBy: [{ city: 'asc' }, { name: 'asc' }],
                    },
                },
                orderBy: { name: 'asc' },
            });
        }
        else if (isDealershipAdmin(account)) {
            const dealerships = await db_1.prisma.dealership.findMany({
                where: { id: { in: getDealershipIds(account) }, holdingId: { not: null } },
                select: { holdingId: true },
            });
            const holdingIds = [...new Set(dealerships.map((item) => item.holdingId).filter(Boolean))];
            items = holdingIds.length === 0
                ? []
                : await db_1.prisma.holding.findMany({
                    where: { id: { in: holdingIds } },
                    include: {
                        dealerships: {
                            orderBy: [{ city: 'asc' }, { name: 'asc' }],
                        },
                    },
                    orderBy: { name: 'asc' },
                });
        }
        else {
            throw new Error('Нет доступа.');
        }
        res.json({ items: items.map(normalizeHoldingResponse) });
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
    }
}
async function handleListDealerships(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    try {
        let items;
        if (isPlatformSuperadmin(account)) {
            items = await getDealershipsSnapshot();
        }
        else if (isHoldingAdmin(account)) {
            items = await db_1.prisma.dealership.findMany({
                where: { holdingId: { in: getHoldingIds(account) } },
                include: {
                    holding: true,
                    _count: {
                        select: { managerProfiles: true },
                    },
                },
                orderBy: [{ city: 'asc' }, { name: 'asc' }],
            });
        }
        else if (isDealershipAdmin(account)) {
            items = await db_1.prisma.dealership.findMany({
                where: { id: { in: getDealershipIds(account) } },
                include: {
                    holding: true,
                    _count: {
                        select: { managerProfiles: true },
                    },
                },
                orderBy: [{ city: 'asc' }, { name: 'asc' }],
            });
        }
        else {
            throw new Error('Нет доступа.');
        }
        res.json({ items: items.map(normalizeDealershipResponse) });
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
    }
}
async function handleCreateHolding(req, res) {
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
    const name = parseString(body.name);
    const code = parseString(body.code);
    const isActive = parseBoolean(body.isActive, true);
    const dealershipIds = parseDealershipIds(body.dealershipIds);
    if (!name) {
        res.status(400).json({ error: 'Название холдинга обязательно.' });
        return;
    }
    try {
        const created = await db_1.prisma.$transaction(async (tx) => {
            const holding = await tx.holding.create({
                data: { name, code, isActive },
            });
            if (dealershipIds.length > 0) {
                await tx.dealership.updateMany({
                    where: { id: { in: dealershipIds } },
                    data: { holdingId: holding.id },
                });
            }
            return tx.holding.findUniqueOrThrow({
                where: { id: holding.id },
                include: {
                    dealerships: {
                        orderBy: [{ city: 'asc' }, { name: 'asc' }],
                    },
                },
            });
        });
        res.status(201).json({ item: normalizeHoldingResponse(created) });
    }
    catch (error) {
        console.error('Create holding error:', error);
        res.status(500).json({ error: 'Не удалось создать холдинг.' });
    }
}
async function handleUpdateHolding(req, res) {
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
    const holdingId = String(req.params.holdingId || '').trim();
    if (!holdingId) {
        res.status(400).json({ error: 'Некорректный holdingId.' });
        return;
    }
    const body = (req.body || {});
    const name = body.name != null ? parseString(body.name) : undefined;
    const code = body.code != null ? parseString(body.code) : undefined;
    const isActive = body.isActive != null ? parseBoolean(body.isActive, true) : undefined;
    const dealershipIds = body.dealershipIds != null ? parseDealershipIds(body.dealershipIds) : undefined;
    if (body.name != null && !name) {
        res.status(400).json({ error: 'Название холдинга не может быть пустым.' });
        return;
    }
    try {
        await db_1.prisma.$transaction(async (tx) => {
            const holdingData = {};
            if (name !== undefined && name !== null)
                holdingData.name = name;
            if (code !== undefined)
                holdingData.code = code;
            if (isActive !== undefined)
                holdingData.isActive = isActive;
            await tx.holding.update({
                where: { id: holdingId },
                data: holdingData,
            });
            if (dealershipIds) {
                await tx.dealership.updateMany({
                    where: { holdingId },
                    data: { holdingId: null },
                });
                if (dealershipIds.length > 0) {
                    await tx.dealership.updateMany({
                        where: { id: { in: dealershipIds } },
                        data: { holdingId },
                    });
                }
            }
        });
        const updated = await db_1.prisma.holding.findUniqueOrThrow({
            where: { id: holdingId },
            include: {
                dealerships: {
                    orderBy: [{ city: 'asc' }, { name: 'asc' }],
                },
            },
        });
        res.json({ item: normalizeHoldingResponse(updated) });
    }
    catch (error) {
        console.error('Update holding error:', error);
        res.status(500).json({ error: 'Не удалось обновить холдинг.' });
    }
}
async function handleDeleteHolding(req, res) {
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
    const holdingId = String(req.params.holdingId || '').trim();
    if (!holdingId) {
        res.status(400).json({ error: 'Некорректный holdingId.' });
        return;
    }
    try {
        await db_1.prisma.$transaction(async (tx) => {
            await tx.dealership.updateMany({
                where: { holdingId },
                data: { holdingId: null },
            });
            await tx.accountMembership.deleteMany({
                where: { holdingId },
            });
            await tx.holding.delete({
                where: { id: holdingId },
            });
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete holding error:', error);
        res.status(500).json({ error: 'Не удалось удалить холдинг.' });
    }
}
async function handleCreateDealership(req, res) {
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
    const name = parseString(body.name);
    const code = parseString(body.code);
    const city = parseString(body.city);
    const address = parseString(body.address);
    const holdingId = parseString(body.holdingId);
    const isActive = parseBoolean(body.isActive, true);
    if (!name) {
        res.status(400).json({ error: 'Название автосалона обязательно.' });
        return;
    }
    try {
        const created = await db_1.prisma.dealership.create({
            data: {
                name,
                code,
                city,
                address,
                holdingId,
                isActive,
            },
            include: {
                holding: true,
                _count: {
                    select: { managerProfiles: true },
                },
            },
        });
        res.status(201).json({ item: normalizeDealershipResponse(created) });
    }
    catch (error) {
        console.error('Create dealership error:', error);
        res.status(500).json({ error: 'Не удалось создать автосалон.' });
    }
}
async function handleUpdateDealership(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    try {
        if (!isPlatformSuperadmin(account) && !isHoldingAdmin(account) && !isDealershipAdmin(account)) {
            throw new Error('Нет доступа.');
        }
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Нет доступа.' });
        return;
    }
    const dealershipId = String(req.params.dealershipId || '').trim();
    if (!dealershipId) {
        res.status(400).json({ error: 'Некорректный dealershipId.' });
        return;
    }
    const body = (req.body || {});
    const name = body.name != null ? parseString(body.name) : undefined;
    const code = body.code != null ? parseString(body.code) : undefined;
    const city = body.city != null ? parseString(body.city) : undefined;
    const address = body.address != null ? parseString(body.address) : undefined;
    const holdingId = body.holdingId != null ? parseString(body.holdingId) : undefined;
    const isActive = body.isActive != null ? parseBoolean(body.isActive, true) : undefined;
    if (body.name != null && !name) {
        res.status(400).json({ error: 'Название автосалона не может быть пустым.' });
        return;
    }
    try {
        const existing = await db_1.prisma.dealership.findUnique({
            where: { id: dealershipId },
            select: { id: true, holdingId: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Автосалон не найден.' });
            return;
        }
        if (!canManageDealershipForAccount(account, { dealershipId: existing.id, holdingId: existing.holdingId })) {
            res.status(403).json({ error: 'Нет доступа к этому автосалону.' });
            return;
        }
        const dealershipData = {};
        if (name !== undefined && name !== null)
            dealershipData.name = name;
        if (code !== undefined)
            dealershipData.code = code;
        if (city !== undefined)
            dealershipData.city = city;
        if (address !== undefined)
            dealershipData.address = address;
        if (holdingId !== undefined) {
            dealershipData.holding = holdingId
                ? { connect: { id: holdingId } }
                : { disconnect: true };
        }
        if (isActive !== undefined)
            dealershipData.isActive = isActive;
        const updated = await db_1.prisma.dealership.update({
            where: { id: dealershipId },
            data: dealershipData,
            include: {
                holding: true,
                _count: {
                    select: { managerProfiles: true },
                },
            },
        });
        res.json({ item: normalizeDealershipResponse(updated) });
    }
    catch (error) {
        console.error('Update dealership error:', error);
        res.status(500).json({ error: 'Не удалось обновить автосалон.' });
    }
}
async function handleDeleteDealership(req, res) {
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
    const dealershipId = String(req.params.dealershipId || '').trim();
    if (!dealershipId) {
        res.status(400).json({ error: 'Некорректный dealershipId.' });
        return;
    }
    try {
        await db_1.prisma.accountMembership.deleteMany({
            where: { dealershipId },
        });
        await db_1.prisma.dealership.delete({
            where: { id: dealershipId },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete dealership error:', error);
        res.status(500).json({ error: 'Не удалось удалить автосалон.' });
    }
}
async function handleSyncMockOrganization(req, res) {
    const account = req.authAccount;
    if (!account) {
        res.status(401).json({ error: 'Требуется авторизация.' });
        return;
    }
    try {
        assertSuperadmin(account);
        const summary = await syncMockOrganization();
        res.json({ success: true, summary });
    }
    catch (error) {
        console.error('Sync mock organization error:', error);
        res.status(403).json({ error: error instanceof Error ? error.message : 'Не удалось синхронизировать структуру.' });
    }
}
//# sourceMappingURL=organizationManagement.js.map