import { Context } from 'telegraf';
import { type Strictness } from '../llm/virtualClient';
import type { ClientProfile } from '../logic/clientProfile';
export declare function handleStopTraining(ctx: Context): Promise<void>;
export declare function showTrainingMenu(ctx: Context): Promise<void>;
export declare function showStrictnessChoice(ctx: Context): void;
/**
 * Show client profile selection after strictness is chosen.
 */
export declare function showProfileChoice(ctx: Context, strictness: Strictness): void;
export declare function handleStartTraining(ctx: Context, strictness?: Strictness, profile?: ClientProfile): Promise<void>;
//# sourceMappingURL=training.d.ts.map