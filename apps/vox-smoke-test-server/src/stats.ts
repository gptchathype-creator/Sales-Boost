import * as fs from "node:fs";
import * as path from "node:path";
import type { VoxCallMetrics } from "@smoke/voximplant-smoke";

export interface VoxStatsSummary {
  total: number;
  deliveredCount: number;
  deliveredRate: number;
  statusDistribution: Record<string, number>;
  avgPddMs: number | null;
  avgAnswerDelayMs: number | null;
}

export function loadVoxSummaries(
  summaryPath = path.resolve("./out/vox_call_summaries.jsonl")
): VoxCallMetrics[] {
  if (!fs.existsSync(summaryPath)) {
    return [];
  }
  const lines = fs
    .readFileSync(summaryPath, "utf-8")
    .split("\n")
    .filter(Boolean);
  return lines.map((l) => JSON.parse(l) as VoxCallMetrics);
}

export function computeVoxStats(summaries: VoxCallMetrics[]): VoxStatsSummary {
  const total = summaries.length;
  if (total === 0) {
    return {
      total: 0,
      deliveredCount: 0,
      deliveredRate: 0,
      statusDistribution: {},
      avgPddMs: null,
      avgAnswerDelayMs: null,
    };
  }

  const statusDistribution: Record<string, number> = {};
  let deliveredCount = 0;
  let pddSum = 0;
  let pddCount = 0;
  let answerSum = 0;
  let answerCount = 0;

  for (const s of summaries) {
    statusDistribution[s.finalStatus] = (statusDistribution[s.finalStatus] ?? 0) + 1;

    if (s.connectedAt) {
      deliveredCount += 1;
    }

    if (typeof s.pddMs === "number") {
      pddSum += s.pddMs;
      pddCount += 1;
    }
    if (typeof s.answerDelayMs === "number") {
      answerSum += s.answerDelayMs;
      answerCount += 1;
    }
  }

  return {
    total,
    deliveredCount,
    deliveredRate: deliveredCount / total,
    statusDistribution,
    avgPddMs: pddCount ? pddSum / pddCount : null,
    avgAnswerDelayMs: answerCount ? answerSum / answerCount : null,
  };
}

export function printVoxStats(stats: VoxStatsSummary): void {
  if (stats.total === 0) {
    console.log("No Voximplant call summaries found.");
    return;
  }

  console.log("\n=== Voximplant Call Statistics ===\n");
  console.log(`Total calls: ${stats.total}`);
  console.log(
    `Delivered rate: ${(stats.deliveredRate * 100).toFixed(1)}% (${stats.deliveredCount}/${stats.total})`
  );
  console.log(
    `Avg PDD: ${
      stats.avgPddMs !== null ? stats.avgPddMs.toFixed(0) : "N/A"
    } ms`
  );
  console.log(
    `Avg Answer Delay: ${
      stats.avgAnswerDelayMs !== null ? stats.avgAnswerDelayMs.toFixed(0) : "N/A"
    } ms`
  );

  console.log("\nStatus distribution:");
  for (const [status, count] of Object.entries(stats.statusDistribution).sort(
    (a, b) => b[1] - a[1]
  )) {
    const pct = ((count / stats.total) * 100).toFixed(1);
    console.log(`  ${status}: ${count} (${pct}%)`);
  }
  console.log();
}

if (require.main === module) {
  const summaries = loadVoxSummaries();
  const stats = computeVoxStats(summaries);
  printVoxStats(stats);
}
