import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { resolveSettings, type DeepcodingSettings, type PermissionMode, type ResolvedDeepcodingSettings, DEFAULT_PERMISSION_MODE } from "../settings";

const DEFAULT_MODEL = "deepseek-v4-pro";
const DEFAULT_BASE_URL = "https://api.deepseek.com";

export class SettingsService {
  private static instance: SettingsService;
  private cache: ResolvedDeepcodingSettings | null = null;
  private settingsPath: string;
  private settingsDir: string;

  private constructor() {
    this.settingsDir = path.join(os.homedir(), ".deepcode");
    this.settingsPath = path.join(this.settingsDir, "settings.json");
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Get the current resolved settings (with caching).
   */
  getResolvedSettings(): ResolvedDeepcodingSettings {
    if (!this.cache) {
      const raw = this.readSettingsFile();
      this.cache = resolveSettings(raw, {
        model: DEFAULT_MODEL,
        baseURL: DEFAULT_BASE_URL
      });
    }
    return this.cache;
  }

  /**
   * Get the current raw settings from file.
   */
  getRawSettings(): DeepcodingSettings {
    return this.readSettingsFile();
  }

  /**
   * Update settings with a callback function.
   */
  updateSettings(updater: (current: DeepcodingSettings) => DeepcodingSettings): void {
    const raw = this.readSettingsFile();
    const updated = updater(raw);
    this.writeSettingsFile(updated);
    this.cache = null; // Invalidate cache
  }

  /**
   * Get the current permission mode (with default fallback).
   */
  getPermissionMode(): PermissionMode {
    const raw = this.readSettingsFile();
    const mode = raw.permissionMode;
    if (mode === "plan" || mode === "accept-edits" || mode === "bypass-permissions") {
      return mode;
    }
    return DEFAULT_PERMISSION_MODE;
  }

  /**
   * Set the permission mode.
   */
  setPermissionMode(mode: PermissionMode): void {
    this.updateSettings((s) => ({ ...s, permissionMode: mode }));
  }

  /**
   * Get the AskUserQuestion call limit per session (default 2).
   */
  getAskUserQuestionLimit(): number {
    const raw = this.readSettingsFile();
    const limit = raw.askUserQuestionLimit;
    return typeof limit === "number" && limit > 0 ? Math.floor(limit) : 2;
  }

  /**
   * Get the settings file path.
   */
  getSettingsPath(): string {
    return this.settingsPath;
  }

  /**
   * Invalidate the cache (useful after external changes).
   */
  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Read and parse settings file.
   */
  private readSettingsFile(): DeepcodingSettings {
    try {
      if (!fs.existsSync(this.settingsPath)) {
        return {};
      }
      const raw = fs.readFileSync(this.settingsPath, "utf8");
      return JSON.parse(raw) as DeepcodingSettings;
    } catch (error) {
      console.warn("Failed to read settings file:", error);
      return {};
    }
  }

  /**
   * Write settings to file.
   */
  private writeSettingsFile(settings: DeepcodingSettings): void {
    try {
      fs.mkdirSync(this.settingsDir, { recursive: true });
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), "utf8");
    } catch (error) {
      throw new Error(`Failed to write settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Convenience function to get the singleton instance.
 */
export function getSettingsService(): SettingsService {
  return SettingsService.getInstance();
}
