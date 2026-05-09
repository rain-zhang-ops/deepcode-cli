# Deep Code CLI

[Deep Code](https://github.com/lessweb/deepcode-cli) is a terminal AI coding assistant optimized for the `deepseek-v4` model, with support for deep thinking, reasoning effort control, and Agent Skills.

## Installation

```bash
npm install -g @vegamo/deepcode-cli
```

Run `deepcode` inside any project directory to get started.

![intro2](resources/intro2.png)

## Configuration

Create `~/.deepcode/settings.json`:

```json
{
  "env": {
    "MODEL": "deepseek-v4-pro",
    "BASE_URL": "https://api.deepseek.com",
    "API_KEY": "sk-..."
  },
  "thinkingEnabled": true,
  "reasoningEffort": "max",
  "timeout": 120000,
  "maxRetries": 3
}
```

The configuration file is shared with the [Deep Code VSCode extension](https://github.com/lessweb/deepcode) — configure once, use everywhere.

## Key Features

### **Skills**
Deep Code CLI supports agent skills that allow you to extend the assistant's capabilities:

- **User-level Skills**: discovered and activated from `~/.agents/skills/`.
- **Project-level Skills**: loaded from `./.deepcode/skills/` for project-specific workflows.

### **Optimized for DeepSeek**
- Specifically tuned for DeepSeek model performance.
- Reduce costs by using [Context Caching](https://api-docs.deepseek.com/guides/kv_cache).
- Natively supports [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode) and Thinking Effort Control.

## Keyboard Shortcuts

| Key             | Action                                       |
|-----------------|----------------------------------------------|
| `Enter`         | Send the prompt                              |
| `Shift+Enter`   | Insert a newline (also `Ctrl+J`)             |
| `Ctrl+V`        | Paste an image from the clipboard            |
| `Esc`           | Interrupt the current model turn             |
| `/`             | Open the skills / commands menu              |
| `/new`          | Start a fresh conversation                   |
| `/resume`       | Choose a previous conversation to continue   |
| `/skills`       | List available skills                        |
| `/exit`         | Quit Deep Code                               |
| `Ctrl+D` twice  | Quit Deep Code                               |

## Supported Models

- `deepseek-v4-pro` (Recommended)
- `deepseek-v4-flash`
- Any other OpenAI-compatible model

## FAQ

### Does Deep Code have a VSCode extension?

Yes. Deep Code offers a full-featured VSCode extension, available on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=vegamo.deepcode-vscode). The extension shares the `~/.deepcode/settings.json` configuration file with the CLI, so you can switch seamlessly between the terminal and the editor.

### Does Deep Code support understanding images?

Deep Code supports multimodal input — you can paste images from the clipboard with `Ctrl+V`. However, `deepseek-v4` does not support multimodal yet. Some models have multimodal capabilities but impose strict limits on multi-turn dialogue requests. For multimodal input, we recommend using the Volcano Ark `Doubao-Seed-2.0-pro` model, which has the best integration.

### How to automatically send a Slack message after a task completes?

Write a shell notification script that calls a Slack webhook, then set the `notify` field in `~/.deepcode/settings.json` to the full path of the script. For detailed steps, refer to: https://binfer.net/share/jby5xnc-so6g

### How do I enable web search?

Deep Code comes with a built-in, free Web Search tool that works well for most use cases. If you prefer to use a custom script for web search, set the `webSearchTool` field in `~/.deepcode/settings.json` to the full path of your script. For detailed steps, refer to: https://github.com/qorzj/web_search_cli

### Does it support Coding Plan?

Yes. Just set `env.BASE_URL` in `~/.deepcode/settings.json` to an OpenAI-compatible API endpoint. Take Volcano Ark's Coding Plan as an example:

```json
{
  "env": {
    "MODEL": "ark-code-latest",
    "BASE_URL": "https://ark.cn-beijing.volces.com/api/coding/v3",
    "API_KEY": "**************"
  },
  "thinkingEnabled": true
}
```

## Build from Source

### One-command Release Build (auto-select by current OS)

```bash
npm run build:release
```

- macOS: produces `dist/deepcode`, and additionally writes `dist/deepcode-mac` for release.
- Windows: produces `dist/deepcode.exe`, and additionally writes `dist/deepcode-win.exe` for release.

> Note: this command runs `npm run build` first, then runs the platform SEA build for your current OS.

### Prerequisites

- Node.js >= 18.17.0 (Node.js v25+ recommended for building standalone exe)
- npm

## One-command Windows build (recommended)

```powershell
npm run build:exe
```

This command runs typecheck, bundle, SEA blob generation, executable injection, and version verification.
If the build fails, it also prints auto-diagnostic hints for common issues (for example, missing sentinel fuse or accidental Node REPL startup).

### Install Dependencies

```bash
git clone https://github.com/lessweb/deepcode-cli.git
cd deepcode-cli
npm install
```

### Standard Build (for npm publishing)

```bash
npm run build
```

This generates `dist/cli.js`, runnable via `node dist/cli.js` or by installing globally.

### Build Standalone Executable (Node.js SEA)

Uses [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html) to produce a self-contained binary that requires no Node.js installation.

**Platform:** Windows (produces `.exe`); Linux/macOS work the same — replace `.exe` with the appropriate binary name.

**Step 1: Bundle into a single ESM file**

```powershell
npx esbuild src/cli.tsx `
  --bundle --platform=node --format=esm --target=node18 `
  --outfile=dist/cli-full.js `
  --alias:react-devtools-core=./scripts/react-devtools-core-stub.mjs `
  --jsx=automatic --jsx-import-source=react `
  "--banner:js=import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"
```

**Step 2: Generate the SEA entry file and blob**

```bash
node scripts/gen-sea-entry.mjs
node --experimental-sea-config sea-config.json
```

**Step 3: Copy node.exe as the target binary and inject the blob**

```powershell
# Windows PowerShell
Copy-Item (Get-Command node).Source dist\deepcode.exe
npx postject dist\deepcode.exe NODE_SEA_BLOB dist\sea-prep.blob `
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
```

**Step 4: Verify**

```powershell
.\dist\deepcode.exe --version
```

> **Note:** Make sure `dist\deepcode.exe` is not running before building, otherwise the file will be locked and cannot be overwritten.

## Getting Help

- Report bugs or request features on GitHub Issues (https://github.com/lessweb/deepcode-cli/issues)

## License

- MIT

## Support Us

If you find this tool helpful, please consider supporting us by:

- Giving us a Star on GitHub (https://github.com/lessweb/deepcode-cli)
- Submitting feedback and suggestions
- Sharing with your friends and colleagues
