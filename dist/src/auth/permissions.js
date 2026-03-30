"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_API_PERMISSION_MAP = exports.SUPER_ADMIN_TAB_PERMISSIONS = exports.ROLE_PERMISSION_PRESETS = exports.PERMISSION_DEFINITIONS = exports.ALL_PERMISSIONS = exports.PERMISSIONS = exports.APP_ROLES = void 0;
exports.getRolePermissions = getRolePermissions;
exports.membershipGrantsPermission = membershipGrantsPermission;
exports.APP_ROLES = {
    platformSuperadmin: 'platform_superadmin',
    holdingAdmin: 'holding_admin',
    dealershipAdmin: 'dealership_admin',
    manager: 'manager',
};
exports.PERMISSIONS = {
    dashboard: {
        view: 'dashboard.view',
    },
    analytics: {
        view: 'analytics.view',
        export: 'analytics.export',
    },
    holding: {
        view: 'holding.view',
        edit: 'holding.edit',
    },
    dealer: {
        view: 'dealer.view',
        edit: 'dealer.edit',
    },
    manager: {
        view: 'manager.view',
        edit: 'manager.edit',
    },
    user: {
        view: 'user.view',
        create: 'user.create',
        edit: 'user.edit',
        delete: 'user.delete',
    },
    permissionTemplate: {
        view: 'permission_template.view',
        create: 'permission_template.create',
        edit: 'permission_template.edit',
        assign: 'permission_template.assign',
        delete: 'permission_template.delete',
    },
    audit: {
        view: 'audit.view',
        export: 'audit.export',
        run: 'audit.run',
        manage: 'audit.manage',
    },
    call: {
        view: 'call.view',
        start: 'call.start',
    },
    callBatch: {
        view: 'call_batch.view',
        create: 'call_batch.create',
        manage: 'call_batch.manage',
    },
    training: {
        view: 'training.view',
        run: 'training.run',
        review: 'training.review',
    },
    profile: {
        view: 'profile.view',
        edit: 'profile.edit',
    },
    settings: {
        view: 'settings.view',
        edit: 'settings.edit',
    },
    expenses: {
        view: 'expenses.view',
        export: 'expenses.export',
    },
    voice: {
        diagnostics: 'voice.diagnostics',
    },
};
function flattenPermissions(tree) {
    const out = [];
    for (const value of Object.values(tree)) {
        if (typeof value === 'string') {
            out.push(value);
            continue;
        }
        if (value && typeof value === 'object') {
            out.push(...flattenPermissions(value));
        }
    }
    return out;
}
exports.ALL_PERMISSIONS = flattenPermissions(exports.PERMISSIONS);
exports.PERMISSION_DEFINITIONS = [
    { key: exports.PERMISSIONS.dashboard.view, description: 'Просмотр платформенного дашборда и сводных KPI.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.analytics.view, description: 'Просмотр аналитики и AI summary.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.analytics.export, description: 'Экспорт аналитических отчётов.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.holding.view, description: 'Просмотр холдингов и их агрегированных данных.', scopes: ['platform', 'holding'] },
    { key: exports.PERMISSIONS.holding.edit, description: 'Изменение холдингов и их конфигурации.', scopes: ['platform'] },
    { key: exports.PERMISSIONS.dealer.view, description: 'Просмотр автосалонов и карточек автосалона.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.dealer.edit, description: 'Редактирование автосалонов и их конфигурации.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.manager.view, description: 'Просмотр сотрудников, попыток, профилей и связанных данных.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.manager.edit, description: 'Редактирование сотрудников и их организационной привязки.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.user.view, description: 'Просмотр web-аккаунтов и их прав.', scopes: ['platform', 'holding'] },
    { key: exports.PERMISSIONS.user.create, description: 'Создание аккаунтов пользователей.', scopes: ['platform', 'holding'] },
    { key: exports.PERMISSIONS.user.edit, description: 'Редактирование аккаунтов пользователей и их назначений.', scopes: ['platform', 'holding'] },
    { key: exports.PERMISSIONS.user.delete, description: 'Удаление аккаунтов пользователей.', scopes: ['platform', 'holding'] },
    { key: exports.PERMISSIONS.permissionTemplate.view, description: 'Просмотр шаблонов прав.', scopes: ['platform'] },
    { key: exports.PERMISSIONS.permissionTemplate.create, description: 'Создание шаблонов прав.', scopes: ['platform'] },
    { key: exports.PERMISSIONS.permissionTemplate.edit, description: 'Редактирование шаблонов прав.', scopes: ['platform'] },
    { key: exports.PERMISSIONS.permissionTemplate.assign, description: 'Назначение шаблонов прав аккаунтам.', scopes: ['platform'] },
    { key: exports.PERMISSIONS.permissionTemplate.delete, description: 'Удаление шаблонов прав.', scopes: ['platform'] },
    { key: exports.PERMISSIONS.audit.view, description: 'Просмотр проверок, разборов, батчей и деталей аудита.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.audit.export, description: 'Экспорт разборов и проверок.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.audit.run, description: 'Запуск ручных проверок и батчей.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.audit.manage, description: 'Пауза, возобновление и остановка батчей проверок.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.call.view, description: 'Просмотр истории звонков и связанных метрик.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.call.start, description: 'Запуск одиночного звонка.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.callBatch.view, description: 'Просмотр списков batch-звонков и их jobs.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.callBatch.create, description: 'Создание batch-звонков.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.callBatch.manage, description: 'Управление batch-звонками: pause, resume, cancel.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.training.view, description: 'Просмотр тренировок и попыток.', scopes: ['platform', 'holding', 'dealer', 'manager-self'] },
    { key: exports.PERMISSIONS.training.run, description: 'Запуск собственных тренировок.', scopes: ['manager-self'] },
    { key: exports.PERMISSIONS.training.review, description: 'Просмотр детальных результатов тренировок.', scopes: ['platform', 'holding', 'dealer', 'manager-self'] },
    { key: exports.PERMISSIONS.profile.view, description: 'Просмотр собственного профиля.', scopes: ['manager-self'] },
    { key: exports.PERMISSIONS.profile.edit, description: 'Редактирование собственного профиля.', scopes: ['manager-self'] },
    { key: exports.PERMISSIONS.settings.view, description: 'Просмотр системных и телеком-настроек.', scopes: ['platform', 'holding', 'dealer'] },
    { key: exports.PERMISSIONS.settings.edit, description: 'Изменение системных и телеком-настроек.', scopes: ['platform'] },
    { key: exports.PERMISSIONS.expenses.view, description: 'Просмотр расходов и служебной финансовой сводки.', scopes: ['platform', 'holding'] },
    { key: exports.PERMISSIONS.expenses.export, description: 'Экспорт расходов и финансовой сводки.', scopes: ['platform', 'holding'] },
    { key: exports.PERMISSIONS.voice.diagnostics, description: 'Просмотр voice env checks, test numbers и оркестраторных диагностик.', scopes: ['platform', 'holding', 'dealer'] },
];
function permissionSet(values) {
    return new Set(values);
}
const HOLDING_ADMIN_PERMISSIONS = permissionSet([
    exports.PERMISSIONS.dashboard.view,
    exports.PERMISSIONS.analytics.view,
    exports.PERMISSIONS.analytics.export,
    exports.PERMISSIONS.holding.view,
    exports.PERMISSIONS.dealer.view,
    exports.PERMISSIONS.dealer.edit,
    exports.PERMISSIONS.manager.view,
    exports.PERMISSIONS.manager.edit,
    exports.PERMISSIONS.user.view,
    exports.PERMISSIONS.user.create,
    exports.PERMISSIONS.user.edit,
    exports.PERMISSIONS.user.delete,
    exports.PERMISSIONS.audit.view,
    exports.PERMISSIONS.audit.export,
    exports.PERMISSIONS.audit.run,
    exports.PERMISSIONS.audit.manage,
    exports.PERMISSIONS.call.view,
    exports.PERMISSIONS.call.start,
    exports.PERMISSIONS.callBatch.view,
    exports.PERMISSIONS.callBatch.create,
    exports.PERMISSIONS.callBatch.manage,
    exports.PERMISSIONS.training.view,
    exports.PERMISSIONS.training.review,
    exports.PERMISSIONS.settings.view,
    exports.PERMISSIONS.expenses.view,
    exports.PERMISSIONS.expenses.export,
    exports.PERMISSIONS.voice.diagnostics,
]);
const DEALERSHIP_ADMIN_PERMISSIONS = permissionSet([
    exports.PERMISSIONS.dashboard.view,
    exports.PERMISSIONS.analytics.view,
    exports.PERMISSIONS.analytics.export,
    exports.PERMISSIONS.dealer.view,
    exports.PERMISSIONS.dealer.edit,
    exports.PERMISSIONS.manager.view,
    exports.PERMISSIONS.manager.edit,
    exports.PERMISSIONS.user.view,
    exports.PERMISSIONS.user.create,
    exports.PERMISSIONS.user.edit,
    exports.PERMISSIONS.user.delete,
    exports.PERMISSIONS.audit.view,
    exports.PERMISSIONS.audit.export,
    exports.PERMISSIONS.audit.run,
    exports.PERMISSIONS.audit.manage,
    exports.PERMISSIONS.call.view,
    exports.PERMISSIONS.call.start,
    exports.PERMISSIONS.callBatch.view,
    exports.PERMISSIONS.callBatch.create,
    exports.PERMISSIONS.callBatch.manage,
    exports.PERMISSIONS.training.view,
    exports.PERMISSIONS.training.review,
    exports.PERMISSIONS.settings.view,
    exports.PERMISSIONS.voice.diagnostics,
]);
const MANAGER_PERMISSIONS = permissionSet([
    exports.PERMISSIONS.profile.view,
    exports.PERMISSIONS.profile.edit,
    exports.PERMISSIONS.training.view,
    exports.PERMISSIONS.training.run,
    exports.PERMISSIONS.training.review,
]);
exports.ROLE_PERMISSION_PRESETS = {
    [exports.APP_ROLES.platformSuperadmin]: permissionSet(exports.ALL_PERMISSIONS),
    [exports.APP_ROLES.holdingAdmin]: HOLDING_ADMIN_PERMISSIONS,
    [exports.APP_ROLES.dealershipAdmin]: DEALERSHIP_ADMIN_PERMISSIONS,
    [exports.APP_ROLES.manager]: MANAGER_PERMISSIONS,
};
exports.SUPER_ADMIN_TAB_PERMISSIONS = {
    dashboard: [exports.PERMISSIONS.dashboard.view],
    holdings: [exports.PERMISSIONS.holding.view, exports.PERMISSIONS.dealer.view],
    companies: [exports.PERMISSIONS.holding.view, exports.PERMISSIONS.dealer.view],
    users: [exports.PERMISSIONS.user.view],
    autodealers: [exports.PERMISSIONS.manager.view],
    audits: [exports.PERMISSIONS.audit.view],
    analytics: [exports.PERMISSIONS.analytics.view],
    settings: [exports.PERMISSIONS.settings.view],
    'dealer-companies': [exports.PERMISSIONS.dealer.view],
    'dealer-calls': [exports.PERMISSIONS.call.view],
    'dealer-employees': [exports.PERMISSIONS.manager.view],
    'dealer-team': [exports.PERMISSIONS.analytics.view],
    'staff-profile': [exports.PERMISSIONS.profile.view],
    'staff-trainer': [exports.PERMISSIONS.training.run],
};
exports.ADMIN_API_PERMISSION_MAP = {
    '/api/admin/summary': [exports.PERMISSIONS.dashboard.view],
    '/api/admin/voice-dashboard': [exports.PERMISSIONS.dashboard.view],
    '/api/admin/expenses': [exports.PERMISSIONS.expenses.view],
    '/api/admin/managers': [exports.PERMISSIONS.manager.view],
    '/api/admin/managers/:managerId/attempts': [exports.PERMISSIONS.manager.view, exports.PERMISSIONS.training.view],
    '/api/admin/users': [exports.PERMISSIONS.user.view],
    '/api/admin/users/:accountId': [exports.PERMISSIONS.user.edit],
    '/api/admin/users/:accountId/delete': [exports.PERMISSIONS.user.delete],
    '/api/admin/rbac/meta': [exports.PERMISSIONS.user.view],
    '/api/admin/holdings': [exports.PERMISSIONS.holding.view],
    '/api/admin/holdings/:holdingId': [exports.PERMISSIONS.holding.edit],
    '/api/admin/dealerships': [exports.PERMISSIONS.dealer.view],
    '/api/admin/dealerships/:dealershipId': [exports.PERMISSIONS.dealer.edit],
    '/api/admin/organization/sync-mock': [exports.PERMISSIONS.holding.edit, exports.PERMISSIONS.dealer.edit],
    '/api/admin/permission-templates': [exports.PERMISSIONS.permissionTemplate.view],
    '/api/admin/permission-templates/:templateId': [exports.PERMISSIONS.permissionTemplate.edit],
    '/api/admin/permission-templates/:templateId/delete': [exports.PERMISSIONS.permissionTemplate.delete],
    '/api/admin/attempts': [exports.PERMISSIONS.training.view],
    '/api/admin/attempts/:attemptId': [exports.PERMISSIONS.training.review],
    '/api/admin/training-sessions/:sessionId': [exports.PERMISSIONS.training.review],
    '/api/admin/call-history': [exports.PERMISSIONS.call.view],
    '/api/admin/call-history/:id': [exports.PERMISSIONS.call.view],
    '/api/admin/start-voice-call': [exports.PERMISSIONS.call.start],
    '/api/admin/call-batches': [exports.PERMISSIONS.callBatch.view, exports.PERMISSIONS.callBatch.create],
    '/api/admin/call-batches/:id': [exports.PERMISSIONS.callBatch.view],
    '/api/admin/call-batches/:id/jobs': [exports.PERMISSIONS.callBatch.view],
    '/api/admin/call-batches/:id/pause': [exports.PERMISSIONS.callBatch.manage],
    '/api/admin/call-batches/:id/resume': [exports.PERMISSIONS.callBatch.manage],
    '/api/admin/call-batches/:id/cancel': [exports.PERMISSIONS.callBatch.manage],
    '/api/admin/voice-env-check': [exports.PERMISSIONS.voice.diagnostics],
    '/api/admin/test-numbers': [exports.PERMISSIONS.voice.diagnostics],
    '/api/admin/super-admin/audits': [exports.PERMISSIONS.audit.view],
    '/api/admin/super-admin/time-series': [exports.PERMISSIONS.analytics.view],
    '/api/admin/super-admin/mock-entities': [exports.PERMISSIONS.holding.view, exports.PERMISSIONS.dealer.view],
    '/api/admin/super-admin/settings': [exports.PERMISSIONS.settings.view],
    '/api/admin/super-admin/dealership-schedules': [exports.PERMISSIONS.voice.diagnostics],
    '/api/admin/super-admin/call-orchestrator-config': [exports.PERMISSIONS.settings.view],
};
function getRolePermissions(role) {
    return exports.ROLE_PERMISSION_PRESETS[role];
}
function membershipGrantsPermission(membership, permission, scope) {
    const role = membership.role;
    const permissions = exports.ROLE_PERMISSION_PRESETS[role];
    if (!permissions || !permissions.has(permission))
        return false;
    if (role === exports.APP_ROLES.platformSuperadmin)
        return true;
    if (role === exports.APP_ROLES.holdingAdmin) {
        if (!scope?.holdingId)
            return true;
        return membership.holdingId === scope.holdingId;
    }
    if (role === exports.APP_ROLES.dealershipAdmin) {
        if (!scope?.dealershipId)
            return true;
        return membership.dealershipId === scope.dealershipId;
    }
    if (role === exports.APP_ROLES.manager) {
        if (permission === exports.PERMISSIONS.profile.view || permission === exports.PERMISSIONS.profile.edit) {
            return !!scope?.allowSelf;
        }
        if (permission === exports.PERMISSIONS.training.view ||
            permission === exports.PERMISSIONS.training.run ||
            permission === exports.PERMISSIONS.training.review) {
            if (scope?.dealershipId) {
                return membership.dealershipId === scope.dealershipId;
            }
            return !!scope?.allowSelf;
        }
    }
    return true;
}
//# sourceMappingURL=permissions.js.map