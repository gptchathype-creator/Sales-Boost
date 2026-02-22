import { JsonlLogger } from "./logger";
import type { VoxCallMetrics, VoxFinalStatus } from "./types";

export class VoxCallTracker {
  private readonly calls = new Map<string, VoxCallMetrics>();
  private readonly logger: JsonlLogger;

  constructor(logger: JsonlLogger) {
    this.logger = logger;
  }

  register(callId: string, to: string, createdAt?: string): VoxCallMetrics {
    const existing = this.calls.get(callId);
    if (existing) {
      return existing;
    }
    const now = createdAt ?? new Date().toISOString();
    const metrics: VoxCallMetrics = {
      callId,
      to,
      createdAt: now,
      finalStatus: "initiated",
    };
    this.calls.set(callId, metrics);
    return metrics;
  }

  attachVoxCallId(callId: string, voxCallId?: string): VoxCallMetrics | undefined {
    const m = this.calls.get(callId);
    if (!m) return undefined;
    if (voxCallId && !m.voxCallId) {
      m.voxCallId = voxCallId;
    }
    return m;
  }

  onProgress(callId: string, voxCallId: string | undefined, ts: string): VoxCallMetrics | undefined {
    const m = this.register(callId, "unknown", ts);
    this.attachVoxCallId(callId, voxCallId);

    if (!m.firstProgressAt) {
      m.firstProgressAt = ts;
      m.pddMs = new Date(ts).getTime() - new Date(m.createdAt).getTime();
    }
    m.finalStatus = "progress";
    return m;
  }

  onConnected(callId: string, voxCallId: string | undefined, ts: string): VoxCallMetrics | undefined {
    const m = this.register(callId, "unknown", ts);
    this.attachVoxCallId(callId, voxCallId);

    m.connectedAt = ts;
    m.answerDelayMs = new Date(ts).getTime() - new Date(m.createdAt).getTime();
    m.finalStatus = "connected";
    return m;
  }

  onEnded(
    callId: string,
    voxCallId: string | undefined,
    ts: string,
    status: VoxFinalStatus
  ): VoxCallMetrics | undefined {
    const m = this.register(callId, "unknown", ts);
    this.attachVoxCallId(callId, voxCallId);

    m.endedAt = ts;
    m.totalMs = new Date(ts).getTime() - new Date(m.createdAt).getTime();
    m.finalStatus = status;

    this.logger.append("vox_call_summaries.jsonl", m);
    return m;
  }

  get(callId: string): VoxCallMetrics | undefined {
    return this.calls.get(callId);
  }

  getAll(): VoxCallMetrics[] {
    return Array.from(this.calls.values());
  }
}
