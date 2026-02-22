import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../../..");
const envLocal = resolve(repoRoot, ".env.local");
const envDefault = resolve(repoRoot, ".env");
if (process.env.NODE_ENV !== "production" && existsSync(envLocal)) {
  config({ path: envLocal });
} else if (existsSync(envDefault)) {
  config({ path: envDefault });
}
import express from "express";
import { randomUUID } from "node:crypto";
import {
  JsonlLogger,
  VoxCallTracker,
  VoxClient,
  loadVoxConfigFromEnv,
  type VoxEventPayload,
} from "@smoke/voximplant-smoke";
import { runBatch, loadNumbersFromFile } from "./batch";
import { computeVoxStats, loadVoxSummaries } from "./stats";

const PORT = parseInt(process.env.VOX_SMOKE_PORT ?? process.env.PORT ?? "3001", 10);

const voxConfig = loadVoxConfigFromEnv();
const voxClient = new VoxClient(voxConfig);
const logger = new JsonlLogger("./out");
const tracker = new VoxCallTracker(logger);

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/** Show which rule/scenario and URLs are used for dialog calls (for debugging). */
app.get("/config", (_req, res) => {
  const dialogBase = process.env.VOICE_DIALOG_BASE_URL?.replace(/\/$/, "");
  res.json({
    VOX_DIALOG_RULE_NAME: process.env.VOX_DIALOG_RULE_NAME ?? "(not set — dialog calls will use VOX_RULE_NAME)",
    VOX_RULE_NAME: process.env.VOX_RULE_NAME ?? "(not set)",
    VOX_DIALOG_SCENARIO_NAME: process.env.VOX_DIALOG_SCENARIO_NAME ?? "voice_dialog",
    VOICE_DIALOG_BASE_URL: dialogBase ?? "(not set)",
    VOICE_USE_STREAM: process.env.VOICE_USE_STREAM ?? "(not set, default POST only)",
    dialog_url: dialogBase ? `${dialogBase}/voice/dialog` : null,
    stream_url: (process.env.VOICE_USE_STREAM === "true" || process.env.VOICE_USE_STREAM === "1") && dialogBase ? dialogBase.replace(/^https:/, "wss:").replace(/^http:/, "ws:") + "/voice/stream" : null,
    VOX_TEST_TO: process.env.VOX_TEST_TO ?? "(not set)",
  });
});

/** Comma-separated list of test numbers for development (VOX_TEST_NUMBERS). */
function getTestNumbers(): string[] {
  const raw = process.env.VOX_TEST_NUMBERS || "";
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\D/g, ""))
    .filter((s) => s.length > 0)
    .map((s) => "+" + s);
}

app.get("/test-numbers", (_req, res) => {
  const numbers = getTestNumbers();
  const defaultTo = process.env.VOX_TEST_TO || (numbers.length > 0 ? numbers[0] : null);
  res.json({
    test_numbers: numbers,
    default_to: defaultTo,
    hint: "POST /call: send { \"to\": \"+79...\" } for one number, or {} to use VOX_TEST_TO. POST /batch: send { \"use_test_numbers\": true } to call all VOX_TEST_NUMBERS.",
  });
});

function normalizeE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits ? "+" + digits : value;
}

app.post("/call", async (req, res) => {
  try {
    const { to, tag, dialog } = req.body as { to?: string; tag?: string; dialog?: boolean };
    const testNumbers = getTestNumbers();
    const defaultTo = process.env.VOX_TEST_TO || (testNumbers.length > 0 ? testNumbers[0] : null);
    const toRaw = to || defaultTo;
    if (!toRaw) {
      res.status(400).json({
        error: "Missing 'to' field. Set VOX_TEST_TO or VOX_TEST_NUMBERS in .env, or send { \"to\": \"+79...\" }.",
      });
      return;
    }

    const toNormalized = normalizeE164(toRaw);
    const callerId = process.env.VOX_CALLER_ID
      ? normalizeE164(process.env.VOX_CALLER_ID)
      : undefined;

    const callId = randomUUID();
    const createdAt = new Date().toISOString();
    tracker.register(callId, toNormalized, createdAt);

    const eventUrl = `${voxConfig.publicBaseUrl.replace(/\/$/, "")}/webhooks/vox`;

    const useDialog = dialog === true;
    const dialogBaseUrl = process.env.VOICE_DIALOG_BASE_URL?.replace(/\/$/, "");
    const dialogUrl = useDialog && dialogBaseUrl ? `${dialogBaseUrl}/voice/dialog` : undefined;
    const streamUrl = useDialog && dialogBaseUrl
      ? dialogBaseUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:") + "/voice/stream"
      : undefined;
    const scenarioName = useDialog
      ? (process.env.VOX_DIALOG_SCENARIO_NAME || "voice_dialog")
      : undefined;
    // In Voximplant, which scenario runs is determined by the RULE, not by a script_name param.
    // Use a rule that has voice_dialog scenario attached (e.g. voice_dialog_rule).
    const ruleName = useDialog
      ? (process.env.VOX_DIALOG_RULE_NAME || null)
      : undefined;

    console.log(`[vox-server] Starting call: ${callId} -> ${toNormalized} (from: ${callerId ?? "default"})${useDialog ? " [voice_dialog]" : ""}`);
    console.log(`[vox-server] Event URL: ${eventUrl}`);
    if (useDialog) {
      console.log(`[vox-server] dialog: rule_name=${ruleName ?? "(not set, will use VOX_RULE_NAME)"} dialog_url=${dialogUrl ?? "(not set)"} stream=${useStream ? "yes" : "no (POST only)"}`);
      if (!dialogUrl) {
        console.warn("[vox-server] VOICE_DIALOG_BASE_URL not set; scenario will not receive dialog_url.");
      }
      if (!ruleName) {
        console.warn("[vox-server] VOX_DIALOG_RULE_NAME not set — Voximplant will use default rule (smoke_test_rule), so smoke_test will run. Set VOX_DIALOG_RULE_NAME=voice_dialog_rule and restart server.");
      }
    }

    await voxClient.startScenario({
      callId,
      to: toNormalized,
      eventUrl,
      callerId,
      tag,
      dialogUrl,
      streamUrl,
      scenarioName,
      ruleName: ruleName ?? undefined,
    });

    console.log(`[vox-server] Vox API call successful for ${callId}`);

    logger.append("vox_events.jsonl", {
      kind: "request",
      call_id: callId,
      to: toNormalized,
      ts: createdAt,
      tag,
    });

    res.json({ call_id: callId, started_at: createdAt });
  } catch (err) {
    console.error("[vox-server] /call error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.post("/batch", async (req, res) => {
  try {
    const {
      numbers,
      file,
      use_test_numbers = false,
      repeat = 2,
      minDelaySec = 20,
      maxDelaySec = 90,
      dryRun = false,
      dailyCap = 5,
      tag,
    } = req.body as {
      numbers?: string[];
      file?: string;
      use_test_numbers?: boolean;
      repeat?: number;
      minDelaySec?: number;
      maxDelaySec?: number;
      dryRun?: boolean;
      dailyCap?: number;
      tag?: string;
    };

    let targetNumbers: string[] = (numbers ?? []).map(normalizeE164);
    if (file) {
      targetNumbers = loadNumbersFromFile(file).map(normalizeE164);
    }
    if (targetNumbers.length === 0 && use_test_numbers) {
      targetNumbers = getTestNumbers();
    }

    if (targetNumbers.length === 0) {
      res.status(400).json({
        error:
          "No numbers provided. Send numbers[], or file, or use_test_numbers: true (uses VOX_TEST_NUMBERS from .env).",
      });
      return;
    }

    res.json({
      status: "scheduled",
      count: targetNumbers.length,
      repeat,
      dryRun,
    });

    setImmediate(() => {
      runBatch(voxClient, tracker, {
        numbers: targetNumbers,
        repeat,
        minDelaySec,
        maxDelaySec,
        dryRun,
        dailyCap,
      }, async (toNumber: string) => {
        const callId = randomUUID();
        const createdAt = new Date().toISOString();
        tracker.register(callId, toNumber, createdAt);

        const eventUrl = `${voxConfig.publicBaseUrl.replace(
          /\/$/,
          ""
        )}/webhooks/vox`;

        const callerId = process.env.VOX_CALLER_ID
          ? normalizeE164(process.env.VOX_CALLER_ID)
          : undefined;
        await voxClient.startScenario({
          callId,
          to: toNumber,
          eventUrl,
          callerId,
          tag,
        });

        logger.append("vox_events.jsonl", {
          kind: "request",
          call_id: callId,
          to: toNumber,
          ts: createdAt,
          tag,
        });
      }).catch((err) => console.error("[vox-server] batch error:", err));
    });
  } catch (err) {
    console.error("[vox-server] /batch error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.post("/webhooks/vox", (req, res) => {
  try {
    const body = req.body as VoxEventPayload;
    if (!body.call_id || !body.event || !body.ts) {
      res.status(400).json({ error: "Invalid Vox event payload" });
      return;
    }

    logger.append("vox_events.jsonl", body);

    const { call_id, vox_call_id, ts, event, to } = body;

    const existing = tracker.get(call_id);
    if (!existing) {
      tracker.register(call_id, to ?? "unknown", ts);
    }

    const eventLower = event.toLowerCase();

    if (eventLower === "progress" || eventLower === "ringing") {
      tracker.onProgress(call_id, vox_call_id, ts);
    } else if (eventLower === "connected" || eventLower === "answer") {
      tracker.onConnected(call_id, vox_call_id, ts);
    } else if (
      eventLower === "disconnected" ||
      eventLower === "hangup" ||
      eventLower === "failed" ||
      eventLower === "busy" ||
      eventLower === "no_answer"
    ) {
      let status: "disconnected" | "failed" | "busy" | "no_answer";
      if (eventLower === "busy") status = "busy";
      else if (eventLower === "no_answer") status = "no_answer";
      else if (eventLower === "failed") status = "failed";
      else status = "disconnected";

      tracker.onEnded(call_id, vox_call_id, ts, status);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[vox-server] /webhooks/vox error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.get("/stats", (_req, res) => {
  const summaries = loadVoxSummaries();
  const stats = computeVoxStats(summaries);
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`[vox-server] Vox smoke-test server listening on :${PORT}`);
});
