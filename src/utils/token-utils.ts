/**
 * Token estimation and formatting utilities for stream progress display
 */

/**
 * Extracts total tokens from usage object (OpenAI API response)
 */
export function getTotalTokens(usage: unknown | null | undefined): number {
  if (!isUsageRecord(usage)) {
    return 0;
  }
  const totalTokens = (usage as Record<string, unknown>).total_tokens;
  return typeof totalTokens === "number" ? totalTokens : 0;
}

/**
 * Estimates token count from text with special handling for Chinese characters
 * Used for real-time stream token estimation during generation
 */
export function estimateStreamTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    // CJK characters are estimated as 0.6 tokens each
    // Other characters are estimated as 0.3 tokens each
    tokens += /[\u3400-\u9fff\uf900-\ufaff]/u.test(char) ? 0.6 : 0.3;
  }
  return tokens;
}

/**
 * Formats estimated token count for display (e.g., "2.5k", "42")
 */
export function formatEstimatedTokens(tokens: number): string {
  if (tokens <= 0) {
    return "0";
  }

  const roundedTokens = Math.round(tokens);
  if (roundedTokens <= 0) {
    return "0";
  }

  if (roundedTokens < 100) {
    return String(roundedTokens);
  }

  if (roundedTokens < 10000) {
    return `${Number((roundedTokens / 1000).toFixed(1))}k`;
  }

  return `${Math.round(roundedTokens / 1000)}k`;
}

/**
 * Type guard: checks if value is a usage record (used internally)
 */
function isUsageRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
