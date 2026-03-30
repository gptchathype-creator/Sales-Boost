import { prisma } from '../db';
import { type VoiceCallScenario } from './startVoiceCall';
import type { VoxWebhookPayload } from './voiceCallSession';
type BatchStatus = 'running' | 'paused' | 'cancelled' | 'completed';
type JobStatus = 'queued' | 'dialing' | 'in_progress' | 'retry_wait' | 'completed' | 'failed' | 'cancelled';
export type BatchMode = 'manual' | 'single_dealership' | 'all_dealerships' | 'auto_daily';
export type BatchJobInput = {
    phone: string;
    dealershipId?: string | null;
    dealershipName?: string | null;
    plannedAt?: Date | string | null;
};
export type CreateCallBatchInput = {
    mode?: BatchMode;
    title?: string;
    jobs: BatchJobInput[];
    maxConcurrency?: number;
    startIntervalMs?: number;
    maxAttempts?: number;
    scenario?: VoiceCallScenario;
    testMode?: boolean;
};
export declare function startCallBatchOrchestrator(): void;
export declare function stopCallBatchOrchestrator(): void;
export declare function createCallBatch(input: CreateCallBatchInput): Promise<{
    batchId: string;
    totalJobs: number;
}>;
export declare function listCallBatches(limit: number, mode?: BatchMode | 'all'): Promise<Array<{
    id: string;
    mode: BatchMode;
    status: BatchStatus;
    title: string | null;
    totalJobs: number;
    queuedJobs: number;
    inProgressJobs: number;
    completedJobs: number;
    failedJobs: number;
    retryingJobs: number;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
}>>;
export declare function getCallBatch(batchId: string): Promise<{
    batch: Awaited<ReturnType<typeof prisma.callBatch.findUnique>>;
    jobsPreview: Awaited<ReturnType<typeof prisma.callBatchJob.findMany>>;
    dealershipSummary: Array<{
        dealershipId: string | null;
        dealershipName: string;
        total: number;
        queued: number;
        inProgress: number;
        retrying: number;
        completed: number;
        failed: number;
        cancelled: number;
        status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'partial';
    }>;
}>;
export declare function getCallBatchJobs(batchId: string, limit: number, offset: number, status?: JobStatus): Promise<{
    jobs: any[];
    total: number;
}>;
export declare function pauseCallBatch(batchId: string): Promise<void>;
export declare function resumeCallBatch(batchId: string): Promise<void>;
export declare function cancelCallBatch(batchId: string): Promise<void>;
export declare function onVoxBatchWebhook(payload: VoxWebhookPayload): Promise<void>;
export {};
//# sourceMappingURL=callBatchOrchestrator.d.ts.map