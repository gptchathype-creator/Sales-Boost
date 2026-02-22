/**
 * Прямой вызов Voximplant StartScenarios API для проверки.
 * Запуск: npx tsx scripts/test-vox-call.ts
 * Показывает запрос и полный ответ API — по нему видно, создаётся ли звонок и нет ли ошибки rule/script.
 */
import "dotenv/config";
import { request } from "undici";
import { randomUUID } from "node:crypto";

const VOX_API_BASE = "https://api.voximplant.com/platform_api";

const accountId = process.env.VOX_ACCOUNT_ID;
const apiKey = process.env.VOX_API_KEY;
const appId = process.env.VOX_APP_ID;
const to = (process.env.VOX_TEST_TO || "").replace(/\D/g, "") ? "+" + (process.env.VOX_TEST_TO || "").replace(/\D/g, "") : null;
const callerId = process.env.VOX_CALLER_ID;
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const dialogBaseUrl = (process.env.VOICE_DIALOG_BASE_URL || "").replace(/\/$/, "");
const scenarioName = process.env.VOX_DIALOG_SCENARIO_NAME || "voice_dialog";
const ruleName = process.env.VOX_DIALOG_RULE_NAME || "voice_dialog_rule";

if (!accountId || !apiKey || !appId) {
  console.error("[VOX TEST] Задайте VOX_ACCOUNT_ID, VOX_API_KEY, VOX_APP_ID в .env");
  process.exit(1);
}
if (!to) {
  console.error("[VOX TEST] Задайте VOX_TEST_TO в .env (например +79778117475)");
  process.exit(1);
}

const callId = randomUUID();
const eventUrl = publicBaseUrl ? `${publicBaseUrl}/webhooks/vox` : "https://example.com/webhooks/vox";
const dialogUrl = dialogBaseUrl ? `${dialogBaseUrl}/voice/dialog` : undefined;
const streamUrl = dialogBaseUrl
  ? dialogBaseUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:") + "/voice/stream"
  : undefined;

const customData: Record<string, unknown> = {
  call_id: callId,
  to: to,
  event_url: eventUrl,
  caller_id: callerId || undefined,
  tag: null,
};
if (dialogUrl) customData.dialog_url = dialogUrl;
if (streamUrl) customData.stream_url = streamUrl;

const formParams: Record<string, string> = {
  account_id: accountId,
  api_key: apiKey,
  application_id: appId,
  script_name: scenarioName,
  script_custom_data: JSON.stringify(customData),
  phone: to,
  output: "json",
  rule_name: ruleName,
};

console.log("[VOX TEST] Request params (api_key hidden):", {
  account_id: accountId,
  application_id: appId,
  script_name: scenarioName,
  rule_name: ruleName,
  phone: to,
  dialog_url: dialogUrl ?? "(not set)",
  stream_url: streamUrl ?? "(not set)",
});
console.log("[VOX TEST] Calling StartScenarios...");

const form = new URLSearchParams(formParams);

request(`${VOX_API_BASE}/StartScenarios`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: form.toString(),
})
  .then(async (res) => {
    const text = await res.body.text();
    console.log("[VOX TEST] HTTP", res.statusCode);
    console.log("[VOX TEST] Response body:", text);
    try {
      const json = JSON.parse(text);
      if (json.error) {
        console.error("[VOX TEST] API error:", json.error);
        process.exit(1);
      }
      if (json.result && json.result.length > 0) {
        console.log("[VOX TEST] Scenario IDs:", json.result);
      }
    } catch (_) {
      // ignore parse
    }
  })
  .catch((err) => {
    console.error("[VOX TEST] Request failed:", err);
    process.exit(1);
  });
