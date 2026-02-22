import * as fs from "node:fs";
import * as path from "node:path";
import type { VoxClient, VoxCallTracker } from "@smoke/voximplant-smoke";

interface BatchConfig {
  numbers: string[];
  repeat: number;
  minDelaySec: number;
  maxDelaySec: number;
  dryRun: boolean;
  dailyCap: number;
}

interface DailyCaps {
  date: string;
  counts: Record<string, number>;
}

const CAPS_FILE = path.resolve("./out/daily_caps_vox.json");

function loadCaps(): DailyCaps {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = fs.readFileSync(CAPS_FILE, "utf-8");
    const caps: DailyCaps = JSON.parse(raw);
    if (caps.date !== today) {
      return { date: today, counts: {} };
    }
    return caps;
  } catch {
    return { date: today, counts: {} };
  }
}

function saveCaps(caps: DailyCaps): void {
  fs.mkdirSync(path.dirname(CAPS_FILE), { recursive: true });
  fs.writeFileSync(CAPS_FILE, JSON.stringify(caps, null, 2));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function loadNumbersFromFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

export async function runBatch(
  voxClient: VoxClient,
  tracker: VoxCallTracker,
  config: BatchConfig,
  makeCall: (to: string, tag?: string) => Promise<void>
): Promise<void> {
  const caps = loadCaps();
  const schedule: Array<{ number: string; delayMs: number; round: number }> = [];

  for (let round = 0; round < config.repeat; round++) {
    for (const num of config.numbers) {
      const currentCount = caps.counts[num] ?? 0;
      if (currentCount >= config.dailyCap) {
        console.log(
          `[vox-batch] Skipping ${num} round ${round + 1}: daily cap (${config.dailyCap}) reached`
        );
        continue;
      }

      const delayMs =
        randomBetween(config.minDelaySec, config.maxDelaySec) * 1000;
      schedule.push({ number: num, delayMs, round: round + 1 });
      caps.counts[num] = currentCount + 1;
    }
  }

  saveCaps(caps);

  console.log(
    `[vox-batch] Scheduled ${schedule.length} calls. dryRun=${config.dryRun}`
  );

  for (let i = 0; i < schedule.length; i++) {
    const entry = schedule[i];
    console.log(
      `[vox-batch] [${i + 1}/${schedule.length}] Round ${
        entry.round
      }: ${entry.number} (delay: ${Math.round(entry.delayMs / 1000)}s)`
    );

    if (!config.dryRun) {
      await sleep(entry.delayMs);
      try {
        await makeCall(entry.number);
      } catch (err) {
        console.error(
          `[vox-batch] Failed to call ${entry.number}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  console.log("[vox-batch] Batch complete.");
}
