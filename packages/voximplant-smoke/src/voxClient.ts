import { request } from "undici";
import type { VoxEnvConfig, VoxStartCallParams } from "./types";

const VOX_API_BASE = "https://api.voximplant.com/platform_api";

export class VoxClient {
  private readonly cfg: VoxEnvConfig;

  constructor(cfg: VoxEnvConfig) {
    this.cfg = cfg;
  }

  /**
   * Start a Voximplant scenario for an outbound PSTN call.
   * We use the StartScenarios API and pass custom data as JSON.
   * The exact response shape is not critical for this smoke test,
   * so we only validate HTTP status and log text on error.
   */
  async startScenario(params: VoxStartCallParams): Promise<void> {
    const customData: Record<string, unknown> = {
      call_id: params.callId,
      to: params.to,
      event_url: params.eventUrl,
      caller_id: params.callerId ?? this.cfg.callerId,
      tag: params.tag,
    };
    if (params.dialogUrl) customData.dialog_url = params.dialogUrl;
    if (params.streamUrl) customData.stream_url = params.streamUrl;

    const formParams: Record<string, string> = {
      account_id: this.cfg.accountId,
      api_key: this.cfg.apiKey,
      application_id: this.cfg.appId,
      script_name: params.scenarioName ?? this.cfg.scenarioName,
      script_custom_data: JSON.stringify(customData),
      phone: params.to,
      output: "json",
    };

    if (params.ruleName) {
      formParams.rule_name = params.ruleName;
    } else if (this.cfg.ruleName) {
      formParams.rule_name = this.cfg.ruleName;
    } else if (this.cfg.ruleId) {
      formParams.rule_id = this.cfg.ruleId;
    }

    const form = new URLSearchParams(formParams);

    console.log(`[VoxClient] Calling Vox API: ${VOX_API_BASE}/StartScenarios`);
    const scriptName = params.scenarioName ?? this.cfg.scenarioName;
    const ruleName = params.ruleName ?? this.cfg.ruleName ?? this.cfg.ruleId;
    console.log(`[VoxClient] Params: account_id=${this.cfg.accountId}, app_id=${this.cfg.appId}, script=${scriptName}, rule=${ruleName ?? "(default)"}, phone=${params.to}`);

    const { statusCode, body: resBody } = await request(
      `${VOX_API_BASE}/StartScenarios`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );

    const text = await resBody.text();
    console.log(`[VoxClient] Response: HTTP ${statusCode}, body: ${text.slice(0, 200)}`);

    if (statusCode >= 400) {
      const errMsg = `Vox StartScenarios failed: HTTP ${statusCode} - ${text.slice(0, 500)}`;
      console.error(`[VoxClient] Error: ${errMsg}`);
      throw new Error(errMsg);
    }

    try {
      const parsed = JSON.parse(text);
      if (parsed.error) {
        const errorMsg = parsed.error.msg || JSON.stringify(parsed.error);
        const errorCode = parsed.error.code || "unknown";
        const errMsg = `Vox StartScenarios error [${errorCode}]: ${errorMsg}`;
        console.error(`[VoxClient] Error in response: ${errMsg}`);
        throw new Error(errMsg);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Vox StartScenarios error")) {
        throw err;
      }
      console.log(`[VoxClient] Response is not JSON or parse failed, continuing...`);
    }
  }
}
