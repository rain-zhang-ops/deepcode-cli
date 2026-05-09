/**
 * Global application constants
 * Centralized configuration values used across the codebase
 */

// Session management
export const MAX_SESSION_ENTRIES = 50;

// Token thresholds for compacting sessions
export const DEFAULT_COMPACT_PROMPT_TOKEN_THRESHOLD = 128 * 1024;
export const DEEPSEEK_V4_COMPACT_PROMPT_TOKEN_THRESHOLD = 512 * 1024;

// Shell command execution limits
export const BASH_MAX_OUTPUT_CHARS = 30000;
export const BASH_MAX_CAPTURE_CHARS = 10 * 1024 * 1024;

// UI limits
export const SLASH_MENU_VISIBLE_MAX = 8;
