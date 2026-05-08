import React from "react";
import { render } from "ink";
import { App } from "./ui";
import { setShellIfWindows } from "./tools/shell-utils";
import { checkForNpmUpdate, promptForPendingUpdate, type PackageInfo } from "./updateCheck";
import { SessionManager, type UserPromptContent } from "./session";
import { createOpenAIClient, resolveCurrentSettings } from "./ui/App";

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
  process.stderr.write("deepcode -p/--print: provide a prompt as an argument or via stdin.\n");
  process.exit(1);
}

if (printMode) {
  void runPrintMode();
} else {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(
      [
        "deepcode - Deep Code CLI",
        "",
        "Usage:",
        "  deepcode               Launch the interactive TUI in the current directory",
        "  deepcode -p <prompt>   Non-interactive: send a one-shot prompt and exit",
        "  deepcode --continue    Resume the most recent session (interactive)",
        "  deepcode --version     Print the version",
        "  deepcode --help        Show this help",
        "",
        "Configuration:",
        "  ~/.deepcode/settings.json   API key, model, base URL",
        "  ~/.agents/skills/*/SKILL.md  User-level skills",
        "  ./.deepcode/skills/*/SKILL.md Project-level skills",
        "  ./AGENTS.md              Project-level agent instructions",
        "",
        "Inside the TUI:",
        "  enter            Send the prompt",
        "  shift+enter      Insert a newline",
        "  home/end         Move within the current line",
        "  alt+left/right   Move by word",
        "  ctrl+w           Delete the previous word",
        "  ctrl+v           Paste an image from the clipboard",
        "  ctrl+x           Clear pasted images",
        "  esc              Interrupt the current model turn",
        "  esc (empty)      Prime backtrack (press esc again to undo last exchange)",
        "  # <note>         Save a note to AGENTS.md without sending to the model",
        "  /                Open the skills/commands menu",
        "  /compact         Manually compact the context window",
        "  /context         Show context window token usage",
        "  /diff            Show git diff inline",
        "  /copy            Copy last response to clipboard",
        "  /clear           Clear the screen",
        "  /init            Generate an AGENTS.md for this project",
        "  /new             Start a fresh conversation",
        "  /resume          Pick a previous conversation to continue",
        "  /exit            Quit",
        "  ctrl+d twice     Quit"
      ].join("\n") + "\n"
    );
    process.exit(0);
  }

  // --continue / -c flag: resume the most recent session
  const continueMode = args.includes("--continue") || args.includes("-c");

  const projectRoot = process.cwd();
  configureWindowsShell();

  if (!process.stdin.isTTY) {
    process.stderr.write(
      "deepcode requires an interactive terminal (TTY). " +
        "Re-run from a real terminal session.\n"
    );
    process.exit(1);
  }

  void main(continueMode);
}

async function runPrintMode(): Promise<void> {
  const prompt = await readPrintPrompt();
  if (!prompt) {
    process.stderr.write("deepcode -p: empty prompt.\n");
    process.exit(1);
  }

  const projectRoot = process.cwd();
  configureWindowsShell();

  const manager = new SessionManager({
    projectRoot,
    createOpenAIClient: () => createOpenAIClient(),
    getResolvedSettings: () => resolveCurrentSettings(),
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
  const updatePromptResult = await promptForPendingUpdate(packageInfo);

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

  if (!updatePromptResult.installed) {
    void checkForNpmUpdate(packageInfo);
  }

  if (continueMode) {
    // Find the most recent session for the current project
    const tmpManager = new SessionManager({
      projectRoot,
      createOpenAIClient: () => createOpenAIClient(),
      getResolvedSettings: () => resolveCurrentSettings(),
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
