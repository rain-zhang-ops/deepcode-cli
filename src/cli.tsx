import React from "react";
import { render } from "ink";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { bootstrapTrustedTls } from "./network/tls-bootstrap";

bootstrapTrustedTls();

import { App } from "./ui";
import { setShellIfWindows } from "./tools/shell-utils";
import { ensureRecommendedCliTools } from "./tools/managed-tools";
import type { PackageInfo } from "./updateCheck";
import { SessionManager, type UserPromptContent } from "./session";
import { createOpenAIClient } from "./ui/App";
import { getSettingsService } from "./services/SettingsService";
import type { DeepcodingSettings } from "./settings";
import { t } from "./i18n";

const args = process.argv.slice(2);
const packageInfo = readPackageInfo();

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`${packageInfo.version || "unknown"}\n`);
  process.exit(0);
}

// --print / -p flag: non-interactive one-shot mode (from Claude Code)
const printFlagIdx = args.findIndex((a) => a === "--print" || a === "-p");
const printMode = printFlagIdx !== -1;
const printArgs = printMode ? args.filter((a, i) => i !== printFlagIdx) : args;

// Collect the prompt: remaining positional args or stdin
async function readPrintPrompt(): Promise<string> {
  const positional = printArgs.filter((a) => !a.startsWith("-")).join(" ").trim();
  if (positional) {
    return positional;
  }
  if (!process.stdin.isTTY) {
    return new Promise((resolve) => {
      const chunks: string[] = [];
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (d: string) => chunks.push(d));
      process.stdin.on("end", () => resolve(chunks.join("").trim()));
    });
  }
  process.stderr.write(t("cli_err_print_no_prompt") + "\n");
  process.exit(1);
}

if (printMode) {
  void runPrintMode();
} else {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(
      [
        t("cli_title"),
        "",
        t("cli_usage"),
        t("cli_usage_tui"),
        t("cli_usage_print"),
        t("cli_usage_continue"),
        t("cli_usage_version"),
        t("cli_usage_help"),
        "",
        t("cli_config_header"),
        t("cli_config_settings"),
        t("cli_config_user_skills"),
        t("cli_config_project_skills"),
        t("cli_config_agents"),
        "",
        t("cli_tui_header"),
        t("cli_tui_enter"),
        t("cli_tui_shift_enter"),
        t("cli_tui_home_end"),
        t("cli_tui_alt_arrows"),
        t("cli_tui_ctrl_w"),
        t("cli_tui_ctrl_v"),
        t("cli_tui_ctrl_x"),
        t("cli_tui_esc"),
        t("cli_tui_esc_empty"),
        t("cli_tui_hash"),
        t("cli_tui_slash"),
        t("cli_tui_compact"),
        t("cli_tui_context"),
        t("cli_tui_diff"),
        t("cli_tui_copy"),
        t("cli_tui_clear"),
        t("cli_tui_init"),
        t("cli_tui_model"),
        t("cli_tui_thinking"),
        t("cli_tui_effort"),
        t("cli_tui_cwd"),
        t("cli_tui_key"),
        t("cli_tui_settings"),
        t("cli_tui_new"),
        t("cli_tui_resume"),
        t("cli_tui_exit"),
        t("cli_tui_ctrl_d")
      ].join("\n") + "\n"
    );
    process.exit(0);
  }

  // --continue / -c flag: resume the most recent session
  const continueMode = args.includes("--continue") || args.includes("-c");

  const projectRoot = process.cwd();
  configureWindowsShell();

  if (!process.stdin.isTTY) {
    process.stderr.write(t("cli_err_no_tty") + "\n");
    process.exit(1);
  }

  void main(continueMode);
}

async function runPrintMode(): Promise<void> {
  const prompt = await readPrintPrompt();
  if (!prompt) {
    process.stderr.write(t("cli_err_empty_prompt") + "\n");
    process.exit(1);
  }

  const projectRoot = process.cwd();
  configureWindowsShell();

  const manager = new SessionManager({
    projectRoot,
    createOpenAIClient: () => createOpenAIClient(),
    getResolvedSettings: () => getSettingsService().getResolvedSettings(),
    renderMarkdown: (text) => text,
    onAssistantMessage: (message) => {
      if (typeof message.content === "string" && message.content) {
        process.stdout.write(message.content);
        if (!message.content.endsWith("\n")) {
          process.stdout.write("\n");
        }
      }
    }
  });

  const userPrompt: UserPromptContent = { text: prompt, imageUrls: [] };
  try {
    await manager.handleUserPrompt(userPrompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`deepcode: ${message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

async function main(continueMode: boolean): Promise<void> {
  const projectRoot = process.cwd();
  await ensureRecommendedCliTools().catch(() => undefined);
  await ensureApiKeyConfigured();

  const restartRef: { current: (() => void) | null } = { current: null };

  function startApp(resumeSessionId?: string): void {
    const inkInstance = render(
      <App
        projectRoot={projectRoot}
        version={packageInfo.version}
        resumeSessionId={resumeSessionId}
        onRestart={() => restartRef.current?.()}
      />,
      { exitOnCtrlC: false }
    );

    restartRef.current = () => {
      process.stdout.write("\u001B[2J\u001B[3J\u001B[H");
      inkInstance.unmount();
      startApp();
    };

    inkInstance.waitUntilExit().then(() => {
      if (!restartRef.current) {
        process.exit(0);
      }
    });
  }

  if (continueMode) {
    // Find the most recent session for the current project
    const tmpManager = new SessionManager({
      projectRoot,
      createOpenAIClient: () => createOpenAIClient(),
      getResolvedSettings: () => getSettingsService().getResolvedSettings(),
      renderMarkdown: (text) => text
    });
    const sessions = tmpManager.listSessions();
    const lastSession = sessions[0];
    if (lastSession) {
      startApp(lastSession.id);
      return;
    }
  }

  startApp();
}

async function ensureApiKeyConfigured(): Promise<void> {
  const existing = getSettingsService().getRawSettings();
  if (existing?.env?.API_KEY?.trim()) {
    return;
  }

  const settingsPath = getSettingsService().getSettingsPath();
  const settingsDir = path.dirname(settingsPath);

  process.stdout.write("\n" + t("cli_setup_no_key") + "\n");
  process.stdout.write(t("cli_setup_save_to", settingsPath) + "\n\n");

  const apiKey = await promptLine(t("cli_setup_prompt"));
  if (!apiKey) {
    process.stderr.write(t("cli_setup_required") + "\n");
    process.exit(1);
  }

  getSettingsService().updateSettings((current) => ({
    ...current,
    env: {
      ...(current?.env ?? {}),
      API_KEY: apiKey
    }
  }));

  process.stdout.write("\n" + t("cli_setup_saved") + "\n\n");
}

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createInterface } = require("readline") as typeof import("readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function configureWindowsShell(): void {
  process.env.NoDefaultCurrentDirectoryInExePath = "1";
  try {
    setShellIfWindows();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`deepcode: ${message}\n`);
    process.exit(1);
  }
}

function readPackageInfo(): PackageInfo {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require("../package.json") as { name?: unknown; version?: unknown };
    return {
      name: typeof pkg.name === "string" ? pkg.name : "@vegamo/deepcode-cli",
      version: typeof pkg.version === "string" ? pkg.version : ""
    };
  } catch {
    return { name: "@vegamo/deepcode-cli", version: "" };
  }
}
