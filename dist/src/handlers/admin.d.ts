import { Context } from 'telegraf';
export declare function handleAdmin(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleAdminLatest(ctx: Context, page?: number): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleAdminByManager(ctx: Context, page?: number): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleAdminManagerDetail(ctx: Context, userId: number): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleAdminSummary(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleDeleteMe(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleCheckAdmin(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
//# sourceMappingURL=admin.d.ts.map