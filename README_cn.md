# Deep Code CLI

[Deep Code](https://github.com/lessweb/deepcode-cli) 是专为 `deepseek-v4` 模型优化的终端 AI 编码助手，支持深度思考、推理强度控制以及 Agent Skills。

## 安装

```bash
npm install -g @vegamo/deepcode-cli
```

在任意项目目录下运行 `deepcode` 即可启动。

![intro2](resources/intro2.png)

## 配置

创建 `~/.deepcode/settings.json` 文件，内容如下：

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

配置文件与 [Deep Code VSCode 插件](https://github.com/lessweb/deepcode) 共享，无需重复配置。

## 主要功能

### **Skills**
Deep Code CLI 支持 agent skills，允许您扩展助手的能力：

- **User-level Skills**：从 `~/.agents/skills/` 目录中发现并激活 skills。
- **Project-level Skills**：从 `./.deepcode/skills/` 目录中加载项目专属 skills。

### **全局规则（Global Rules）**
支持从 `~/.agents/rules/` 目录加载跨项目通用规则：

- 在 `~/.agents/rules/` 目录中放置任意 `.md` 文件，即可作为全局规则应用于所有项目。
- 全局规则会与项目级 `AGENTS.md` 和用户级 `~/.deepcode/AGENTS.md` 共同加载，无需重复配置。

### **为 DeepSeek 优化**
- 专门为 DeepSeek 模型性能调优。
- 通过使用[上下文缓存](https://api-docs.deepseek.com/guides/kv_cache)来降低成本。
- 原生支持[思考模式](https://api-docs.deepseek.com/guides/thinking_mode)和思考强度控制。

## 快捷键

| 键              | 操作                              |
|-----------------|-----------------------------------|
| `Enter`         | 发送消息                          |
| `Shift+Enter`   | 插入换行（也可用 `Ctrl+J`）       |
| `Ctrl+V`        | 从剪贴板粘贴图片                  |
| `Esc`           | 中断当前模型回复                  |
| `Alt+.`         | 提升思考强度（关闭 → high → max） |
| `Alt+,`         | 降低思考强度（max → high → 关闭） |
| `/`             | 打开 skills / 命令菜单            |
| `/new`          | 开始新对话                        |
| `/resume`       | 选择历史对话继续                  |
| `/skills`       | 列出可用 skills                   |
| `/exit`         | 退出                              |
| 连续 `Ctrl+D`   | 退出                              |

## 支持的模型

- `deepseek-v4-pro`（推荐使用）
- `deepseek-v4-flash`
- 任何其他 OpenAI 兼容模型


## 常见问题

### Deep Code 是否有 VSCode 插件？

有的。Deep Code 提供功能完整的 VSCode 插件，可在 [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=vegamo.deepcode-vscode) 安装。插件与 CLI 共享 `~/.deepcode/settings.json` 配置文件，可以在终端和编辑器之间无缝切换。

### Deep Code 是否支持理解图片？

Deep Code 支持多模态，可使用ctrl+v从剪贴板粘贴图片。但目前 deepseek-v4 不支持多模态。有些模型虽然有多模态能力，但对多轮对话请求的限制太严。目前多模态输入推荐使用火山方舟的 Doubao-Seed-2.0-pro 模型，适配效果最好。

### 怎样在任务完成后自动给 Slack 发消息？

编写一个调用 Slack webhook 的 Shell 通知脚本，然后在 `~/.deepcode/settings.json` 中将 `notify` 字段设为该脚本的完整路径即可。详细步骤可参考：https://binfer.net/share/jby5xnc-so6g

### 怎样启用联网搜索功能？

Deep Code自带免费的、且大部分情况够用的Web Search工具。如果你希望使用自定义脚本进行联网搜索，可以在 `~/.deepcode/settings.json` 中将 `webSearchTool` 设为脚本的完整路径即可。详细步骤可参考：https://github.com/qorzj/web_search_cli

### 是否支持 Coding Plan？

支持。只要把 `~/.deepcode/settings.json` 的 `env.BASE_URL` 配置为 OpenAI 兼容的接口地址就行。以火山方舟的 Coding Plan 为例：

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

## 编译教程

**Windows 一键构建（推荐）**

```powershell
npm run build:exe
```

该命令会自动执行类型检查、打包、生成 SEA blob、注入可执行文件并做版本验证。
若构建失败，会输出常见问题的自动诊断建议（例如 sentinel 缺失、误进入 Node REPL）。

### 前置条件

- Node.js >= 18.17.0（构建独立 exe 推荐使用 Node.js v25+）
- npm

### 安装依赖

```bash
git clone https://github.com/lessweb/deepcode-cli.git
cd deepcode-cli
npm install
```

### 标准构建（用于 npm 发布）

```bash
npm run build
```

生成 `dist/cli.js`，可通过 `node dist/cli.js` 或全局安装后使用。

### 构建独立可执行文件（Node.js SEA）

使用 [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html) 将 CLI 打包为无需安装 Node.js 的独立 exe。

**适用平台：** Windows（生成 `.exe`）；Linux/macOS 同理，将 `.exe` 换为对应可执行文件名即可。

**步骤 1：打包为单文件 ESM bundle**

```powershell
npx esbuild src/cli.tsx `
  --bundle --platform=node --format=esm --target=node18 `
  --outfile=dist/cli-full.js `
  --alias:react-devtools-core=./scripts/react-devtools-core-stub.mjs `
  --jsx=automatic --jsx-import-source=react `
  "--banner:js=import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"
```

**步骤 2：生成 SEA 入口文件和 blob**

```bash
node scripts/gen-sea-entry.mjs
node --experimental-sea-config sea-config.json
```

**步骤 3：将 node.exe 复制为目标可执行文件，并注入 blob**

```powershell
# Windows PowerShell
Copy-Item (Get-Command node).Source dist\deepcode.exe
npx postject dist\deepcode.exe NODE_SEA_BLOB dist\sea-prep.blob `
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
```

**步骤 4：验证**

```powershell
.\dist\deepcode.exe --version
```

> **注意：** 构建前请确保 `dist\deepcode.exe` 没有在运行，否则文件被占用无法覆盖。

## 获取帮助

- 在 GitHub Issues 上报告错误或请求功能 (https://github.com/lessweb/deepcode-cli/issues)

## 协议

- MIT

## 支持我们

如果你觉得这个工具对你有帮助，请考虑通过以下方式支持我们：

- 在 GitHub 上给我们一个 Star (https://github.com/lessweb/deepcode-cli)
- 向我们提交反馈和建议
- 分享给你的朋友和同事
