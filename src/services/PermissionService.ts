import { getSettingsService } from "./SettingsService";
import type { PermissionMode } from "../settings";

/**
 * Tool categories for permission checking.
 * READ_ONLY tools can always run; WRITE tools are subject to mode restrictions;
 * DANGEROUS bash patterns require a confirmation even in accept-edits mode.
 */
export const READ_ONLY_TOOLS = new Set([
  "read",
  "WebSearch",
  "TodoRead",
]);

const WRITE_TOOLS = new Set([
  "write",
  "edit",
  "bash",
]);

/**
 * Regex patterns for bash commands that are considered high-risk.
 * Even in accept-edits mode these should surface a structured denial.
 */
const HIGH_RISK_BASH_PATTERNS: RegExp[] = [
  /\brm\s+(-[^-\s]*f[^-\s]*|-rf?)\s+\//i,   // rm -rf /...
  /\bgit\s+push\b.*--force\b/i,              // git push --force
  /\bsudo\b/i,                               // any sudo
  /\bchmod\s+[0-7]*7\b/i,                   // chmod *7 (world-writable)
  /\bdd\s+if=/i,                             // dd
  />\s*\/dev\/sd[a-z]/i,                     // overwrite block device
  /\bmkfs\b/i,                               // format filesystem
];

export type PermissionCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export class PermissionService {
  private static instance: PermissionService;

  private constructor() {}

  static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  getMode(): PermissionMode {
    return getSettingsService().getPermissionMode();
  }

  /**
   * Check whether a tool call is allowed under the current permission mode.
   *
   * @param toolName  Registered tool name (e.g. "bash", "edit", "write")
   * @param args      Parsed tool arguments
   */
  check(toolName: string, args: Record<string, unknown>): PermissionCheckResult {
    const mode = this.getMode();

    // Unknown / read-only tools are always allowed.
    if (!WRITE_TOOLS.has(toolName)) {
      return { allowed: true };
    }

    if (mode === "bypass-permissions") {
      return { allowed: true };
    }

    if (mode === "plan") {
      return {
        allowed: false,
        reason:
          `[plan mode] Tool "${toolName}" would ${this.describeOperation(toolName, args)}. ` +
          "Add this as a TODO item instead of executing it now."
      };
    }

    // accept-edits mode: allow writes but block high-risk bash.
    if (toolName === "bash") {
      const command = typeof args.command === "string" ? args.command : "";
      const match = this.findHighRiskPattern(command);
      if (match) {
        return {
          allowed: false,
          reason:
            `[accept-edits] High-risk bash command blocked: matched pattern "${match.toString()}". ` +
            "Use bypass-permissions mode or rewrite the command to avoid destructive operations."
        };
      }
    }

    return { allowed: true };
  }

  private describeOperation(toolName: string, args: Record<string, unknown>): string {
    switch (toolName) {
      case "bash": {
        const cmd = typeof args.command === "string" ? args.command.slice(0, 80) : "?";
        return `run bash: ${cmd}`;
      }
      case "write": {
        const fp = typeof args.file_path === "string" ? args.file_path : "?";
        return `write file: ${fp}`;
      }
      case "edit": {
        const fp = typeof args.file_path === "string" ? args.file_path : "?";
        return `edit file: ${fp}`;
      }
      case "TodoWrite":
        return "update TODO list";
      default:
        return `call ${toolName}`;
    }
  }

  private findHighRiskPattern(command: string): RegExp | null {
    for (const pattern of HIGH_RISK_BASH_PATTERNS) {
      if (pattern.test(command)) {
        return pattern;
      }
    }
    return null;
  }
}

export function getPermissionService(): PermissionService {
  return PermissionService.getInstance();
}
