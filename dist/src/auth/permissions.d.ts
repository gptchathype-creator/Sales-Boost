import type { AccountMembership } from '@prisma/client';
export declare const APP_ROLES: {
    readonly platformSuperadmin: "platform_superadmin";
    readonly holdingAdmin: "holding_admin";
    readonly dealershipAdmin: "dealership_admin";
    readonly manager: "manager";
};
export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];
export declare const PERMISSIONS: {
    readonly dashboard: {
        readonly view: "dashboard.view";
    };
    readonly analytics: {
        readonly view: "analytics.view";
        readonly export: "analytics.export";
    };
    readonly holding: {
        readonly view: "holding.view";
        readonly edit: "holding.edit";
    };
    readonly dealer: {
        readonly view: "dealer.view";
        readonly edit: "dealer.edit";
    };
    readonly manager: {
        readonly view: "manager.view";
        readonly edit: "manager.edit";
    };
    readonly user: {
        readonly view: "user.view";
        readonly create: "user.create";
        readonly edit: "user.edit";
        readonly delete: "user.delete";
    };
    readonly permissionTemplate: {
        readonly view: "permission_template.view";
        readonly create: "permission_template.create";
        readonly edit: "permission_template.edit";
        readonly assign: "permission_template.assign";
        readonly delete: "permission_template.delete";
    };
    readonly audit: {
        readonly view: "audit.view";
        readonly export: "audit.export";
        readonly run: "audit.run";
        readonly manage: "audit.manage";
    };
    readonly call: {
        readonly view: "call.view";
        readonly start: "call.start";
    };
    readonly callBatch: {
        readonly view: "call_batch.view";
        readonly create: "call_batch.create";
        readonly manage: "call_batch.manage";
    };
    readonly training: {
        readonly view: "training.view";
        readonly run: "training.run";
        readonly review: "training.review";
    };
    readonly profile: {
        readonly view: "profile.view";
        readonly edit: "profile.edit";
    };
    readonly settings: {
        readonly view: "settings.view";
        readonly edit: "settings.edit";
    };
    readonly expenses: {
        readonly view: "expenses.view";
        readonly export: "expenses.export";
    };
    readonly voice: {
        readonly diagnostics: "voice.diagnostics";
    };
};
type PermissionTree = typeof PERMISSIONS;
type LeafValues<T> = T extends string ? T : T extends Record<string, unknown> ? LeafValues<T[keyof T]> : never;
export type PermissionKey = LeafValues<PermissionTree>;
export type PermissionScope = 'platform' | 'holding' | 'dealer' | 'manager-self';
export type PermissionDefinition = {
    key: PermissionKey;
    description: string;
    scopes: PermissionScope[];
};
export declare const ALL_PERMISSIONS: PermissionKey[];
export declare const PERMISSION_DEFINITIONS: PermissionDefinition[];
export declare const ROLE_PERMISSION_PRESETS: Record<AppRole, ReadonlySet<PermissionKey>>;
export declare const SUPER_ADMIN_TAB_PERMISSIONS: {
    readonly dashboard: readonly ["dashboard.view"];
    readonly holdings: readonly ["holding.view", "dealer.view"];
    readonly companies: readonly ["holding.view", "dealer.view"];
    readonly users: readonly ["user.view"];
    readonly autodealers: readonly ["manager.view"];
    readonly audits: readonly ["audit.view"];
    readonly analytics: readonly ["analytics.view"];
    readonly settings: readonly ["settings.view"];
    readonly 'dealer-companies': readonly ["dealer.view"];
    readonly 'dealer-calls': readonly ["call.view"];
    readonly 'dealer-employees': readonly ["manager.view"];
    readonly 'dealer-team': readonly ["analytics.view"];
    readonly 'staff-profile': readonly ["profile.view"];
    readonly 'staff-trainer': readonly ["training.run"];
};
export declare const ADMIN_API_PERMISSION_MAP: {
    readonly '/api/admin/summary': readonly ["dashboard.view"];
    readonly '/api/admin/voice-dashboard': readonly ["dashboard.view"];
    readonly '/api/admin/expenses': readonly ["expenses.view"];
    readonly '/api/admin/managers': readonly ["manager.view"];
    readonly '/api/admin/managers/:managerId/attempts': readonly ["manager.view", "training.view"];
    readonly '/api/admin/users': readonly ["user.view"];
    readonly '/api/admin/users/:accountId': readonly ["user.edit"];
    readonly '/api/admin/users/:accountId/delete': readonly ["user.delete"];
    readonly '/api/admin/rbac/meta': readonly ["user.view"];
    readonly '/api/admin/holdings': readonly ["holding.view"];
    readonly '/api/admin/holdings/:holdingId': readonly ["holding.edit"];
    readonly '/api/admin/dealerships': readonly ["dealer.view"];
    readonly '/api/admin/dealerships/:dealershipId': readonly ["dealer.edit"];
    readonly '/api/admin/organization/sync-mock': readonly ["holding.edit", "dealer.edit"];
    readonly '/api/admin/permission-templates': readonly ["permission_template.view"];
    readonly '/api/admin/permission-templates/:templateId': readonly ["permission_template.edit"];
    readonly '/api/admin/permission-templates/:templateId/delete': readonly ["permission_template.delete"];
    readonly '/api/admin/attempts': readonly ["training.view"];
    readonly '/api/admin/attempts/:attemptId': readonly ["training.review"];
    readonly '/api/admin/training-sessions/:sessionId': readonly ["training.review"];
    readonly '/api/admin/call-history': readonly ["call.view"];
    readonly '/api/admin/call-history/:id': readonly ["call.view"];
    readonly '/api/admin/start-voice-call': readonly ["call.start"];
    readonly '/api/admin/call-batches': readonly ["call_batch.view", "call_batch.create"];
    readonly '/api/admin/call-batches/:id': readonly ["call_batch.view"];
    readonly '/api/admin/call-batches/:id/jobs': readonly ["call_batch.view"];
    readonly '/api/admin/call-batches/:id/pause': readonly ["call_batch.manage"];
    readonly '/api/admin/call-batches/:id/resume': readonly ["call_batch.manage"];
    readonly '/api/admin/call-batches/:id/cancel': readonly ["call_batch.manage"];
    readonly '/api/admin/voice-env-check': readonly ["voice.diagnostics"];
    readonly '/api/admin/test-numbers': readonly ["voice.diagnostics"];
    readonly '/api/admin/super-admin/audits': readonly ["audit.view"];
    readonly '/api/admin/super-admin/time-series': readonly ["analytics.view"];
    readonly '/api/admin/super-admin/mock-entities': readonly ["holding.view", "dealer.view"];
    readonly '/api/admin/super-admin/settings': readonly ["settings.view"];
    readonly '/api/admin/super-admin/dealership-schedules': readonly ["voice.diagnostics"];
    readonly '/api/admin/super-admin/call-orchestrator-config': readonly ["settings.view"];
};
export type PermissionScopeContext = {
    holdingId?: string | null;
    dealershipId?: string | null;
    allowSelf?: boolean;
};
export declare function getRolePermissions(role: AppRole): ReadonlySet<PermissionKey>;
export declare function membershipGrantsPermission(membership: Pick<AccountMembership, 'role' | 'holdingId' | 'dealershipId'>, permission: PermissionKey, scope?: PermissionScopeContext): boolean;
export {};
//# sourceMappingURL=permissions.d.ts.map