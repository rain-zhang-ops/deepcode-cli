import { defaultsToThinkingMode } from "./model-capabilities";

export type DeepcodingEnv = {
  MODEL?: string;
  BASE_URL?: string;
  API_KEY?: string;
  THINKING?: string;
};

export type ReasoningEffort = "high" | "max";

export type McpServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type DeepcodingSettings = {
  env?: DeepcodingEnv;
  thinkingEnabled?: boolean;
  reasoningEffort?: ReasoningEffort;
  debugLogEnabled?: boolean;
  timeout?: number;
  maxRetries?: number;
  notify?: string;
  webSearchTool?: string;
  mcpServers?: Record<string, McpServerConfig>;
};

export type ResolvedDeepcodingSettings = {
  apiKey?: string;
  baseURL: string;
  model: string;
  thinkingEnabled: boolean;
  reasoningEffort: ReasoningEffort;
  debugLogEnabled: boolean;
  timeout?: number;
  maxRetries?: number;
  notify?: string;
  webSearchTool?: string;
};

function resolveReasoningEffort(value: unknown): ReasoningEffort {
  return value === "high" || value === "max" ? value : "max";
}

/**
 * Resolve a positive integer config value.
 * Returns undefined for non-numeric, non-finite, zero, or negative inputs.
 * Floors valid numeric inputs to avoid fractional milliseconds/retry counts.
 */
function resolvePositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function resolveThinkingEnabled(
  settings: DeepcodingSettings | null | undefined,
  model: string
): boolean {
  if (typeof settings?.thinkingEnabled === "boolean") {
    return settings.thinkingEnabled;
  }

  const legacyThinking = settings?.env?.THINKING;
  if (typeof legacyThinking === "string" && legacyThinking.trim()) {
    return legacyThinking.trim().toLowerCase() === "enabled";
  }

  return defaultsToThinkingMode(model);
}

export function resolveSettings(
  settings: DeepcodingSettings | null | undefined,
  defaults: { model: string; baseURL: string }
): ResolvedDeepcodingSettings {
  const env = settings?.env ?? {};
  const model = env.MODEL?.trim() || defaults.model;
  const notify = typeof settings?.notify === "string" ? settings.notify.trim() : "";
  const webSearchTool =
    typeof settings?.webSearchTool === "string" ? settings.webSearchTool.trim() : "";

  return {
    apiKey: env.API_KEY?.trim(),
    baseURL: env.BASE_URL?.trim() || defaults.baseURL,
    model,
    thinkingEnabled: resolveThinkingEnabled(settings, model),
    reasoningEffort: resolveReasoningEffort(settings?.reasoningEffort),
    debugLogEnabled: settings?.debugLogEnabled === true,
    timeout: resolvePositiveInteger(settings?.timeout),
    maxRetries: resolvePositiveInteger(settings?.maxRetries),
    notify: notify || undefined,
    webSearchTool: webSearchTool || undefined
  };
}
