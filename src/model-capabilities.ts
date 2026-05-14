export const DEEPSEEK_V4_MODELS = new Set(["deepseek-v4-flash", "deepseek-v4-pro"]);

export const QWEN_VL_MODELS = new Set([
  "qwen-vl-max",
  "qwen-vl-plus",
  "qwen2.5-vl-72b-instruct",
  "qwen2.5-vl-7b-instruct",
  "qwen2.5-vl-3b-instruct"
]);

export function defaultsToThinkingMode(model: string): boolean {
  return DEEPSEEK_V4_MODELS.has(model);
}

export function isQwenVLModel(model: string): boolean {
  return QWEN_VL_MODELS.has(model) || model.startsWith("qwen") && model.includes("vl");
}
