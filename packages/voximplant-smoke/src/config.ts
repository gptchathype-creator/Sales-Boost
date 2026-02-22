import { z } from "zod";
import type { VoxEnvConfig } from "./types";

const envSchema = z.object({
  VOX_ACCOUNT_ID: z.string().min(1, "VOX_ACCOUNT_ID is required"),
  VOX_API_KEY: z.string().min(1, "VOX_API_KEY is required"),
  VOX_APP_ID: z.string().min(1, "VOX_APP_ID is required"),
  VOX_SCENARIO_NAME: z.string().min(1, "VOX_SCENARIO_NAME is required"),
  VOX_RULE_NAME: z.string().optional(),
  VOX_RULE_ID: z.string().optional(),
  VOX_CALLER_ID: z.string().optional(),
  PUBLIC_BASE_URL: z.string().url("PUBLIC_BASE_URL must be a valid URL"),
});

export function loadVoxConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): VoxEnvConfig {
  const parsed = envSchema.parse(env);
  return {
    accountId: parsed.VOX_ACCOUNT_ID,
    apiKey: parsed.VOX_API_KEY,
    appId: parsed.VOX_APP_ID,
    scenarioName: parsed.VOX_SCENARIO_NAME,
    ruleName: parsed.VOX_RULE_NAME,
    ruleId: parsed.VOX_RULE_ID,
    callerId: parsed.VOX_CALLER_ID,
    publicBaseUrl: parsed.PUBLIC_BASE_URL,
  };
}
