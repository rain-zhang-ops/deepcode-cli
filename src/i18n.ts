export type Locale = "en" | "zh";

function detectLocale(): Locale {
  const envLang = (
    process.env.LANG ||
    process.env.LANGUAGE ||
    process.env.LC_ALL ||
    process.env.LC_MESSAGES ||
    ""
  ).toLowerCase();
  if (envLang.startsWith("zh")) return "zh";
  try {
    const sysLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (sysLocale.startsWith("zh")) return "zh";
  } catch {
    // ignore
  }
  return "en";
}

const translations = {
  en: {
    // cli.tsx – help text
    cli_title: "deepcode - Deep Code CLI",
    cli_usage: "Usage:",
    cli_usage_tui: "  deepcode               Launch the interactive TUI in the current directory",
    cli_usage_print: "  deepcode -p <prompt>   Non-interactive: send a one-shot prompt and exit",
    cli_usage_continue: "  deepcode --continue    Resume the most recent session (interactive)",
    cli_usage_version: "  deepcode --version     Print the version",
    cli_usage_help: "  deepcode --help        Show this help",
    cli_config_header: "Configuration:",
    cli_config_settings: "  ~/.deepcode/settings.json   API key, model, base URL",
    cli_config_user_skills: "  ~/.agents/skills/*/SKILL.md  User-level skills",
    cli_config_project_skills: "  ./.deepcode/skills/*/SKILL.md Project-level skills",
    cli_config_agents: "  ./AGENTS.md              Project-level agent instructions",
    cli_tui_header: "Inside the TUI:",
    cli_tui_enter: "  enter            Send the prompt",
    cli_tui_shift_enter: "  shift+enter      Insert a newline",
    cli_tui_home_end: "  home/end         Move within the current line",
    cli_tui_alt_arrows: "  alt+left/right   Move by word",
    cli_tui_ctrl_w: "  ctrl+w           Delete the previous word",
    cli_tui_ctrl_v: "  ctrl+v           Paste an image from the clipboard",
    cli_tui_ctrl_x: "  ctrl+x           Clear pasted images",
    cli_tui_esc: "  esc              Interrupt the current model turn",
    cli_tui_esc_empty:
      "  esc (empty)      Prime backtrack (press esc again to undo last exchange)",
    cli_tui_hash: "  # <note>         Save a note to AGENTS.md without sending to the model",
    cli_tui_slash: "  /                Open the skills/commands menu",
    cli_tui_compact: "  /compact         Manually compact the context window",
    cli_tui_context: "  /context         Show context window token usage",
    cli_tui_diff: "  /diff            Show git diff inline",
    cli_tui_copy: "  /copy            Copy last response to clipboard",
    cli_tui_clear: "  /clear           Clear the screen",
    cli_tui_init: "  /init            Generate an AGENTS.md for this project",
    cli_tui_model: "  /model <name>    Switch AI model",
    cli_tui_thinking: "  /thinking on|off Toggle thinking mode",
    cli_tui_effort: "  /effort high|max Set reasoning effort",
    cli_tui_cwd: "  /cwd <path>      Change working directory",
    cli_tui_key: "  /key <api_key>   Update API key",
    cli_tui_settings: "  /settings        Show current runtime settings",
    cli_tui_new: "  /new             Start a fresh conversation",
    cli_tui_resume: "  /resume          Pick a previous conversation to continue",
    cli_tui_exit: "  /exit            Quit",
    cli_tui_ctrl_d: "  ctrl+d twice     Quit",
    // cli.tsx – errors & setup
    cli_err_print_no_prompt:
      "deepcode -p/--print: provide a prompt as an argument or via stdin.",
    cli_err_no_tty:
      "deepcode requires an interactive terminal (TTY). Re-run from a real terminal session.",
    cli_err_empty_prompt: "deepcode -p: empty prompt.",
    cli_setup_no_key: "No API key found. Enter your DeepSeek API key to get started.",
    cli_setup_save_to: "(Will be saved to {0})",
    cli_setup_prompt: "API Key: ",
    cli_setup_required: "API key is required. Exiting.",
    cli_setup_saved: "API key saved. Starting Deep Code CLI...",
    // ui/App.tsx – feedback messages
    app_copied: "Copied to clipboard.",
    app_copy_failed:
      "Could not write to clipboard. Ensure clipboard utilities are available for your system (pbcopy, xclip/xsel/wl-copy, or PowerShell).",
    app_copy_nothing: "No assistant response to copy yet.",
    app_diff_no_changes: "(no uncommitted changes)",
    app_diff_no_git: "(not a git repository or git is not available)",
    app_compact_no_session: "No active session to compact.",
    app_compacting: "Compacting conversation\u2026",
    app_compacted: "Conversation compacted.",
    app_compact_failed: "Compaction failed: {0}",
    app_context_no_session: "No active session.",
    app_context_header: "**Context Window Usage**",
    app_context_active_tokens: "- Active tokens (last response): {0}",
    app_context_total_tokens: "- Total tokens used (session): {0}",
    app_context_tip: "_Tip: use `/compact` to free up context window space._",
    app_note_saved: 'Saved to AGENTS.md: _"{0}"_',
    app_note_failed: "Could not write to AGENTS.md \u2014 check file permissions.",
    app_agents_exists: "AGENTS.md already exists at `{0}`. Edit it manually or delete it first.",
    app_agents_generating: "Generating AGENTS.md for this project\u2026",
    app_agents_created: "Created `{0}`. It will be loaded on the next session start.",
    app_agents_failed: "Failed to generate AGENTS.md: {0}",
    app_no_api_key: "API key not configured. Please restart the CLI to enter your API key.",
    app_compacting_long: "The conversation is getting long, compacting...",
    app_continue_question:
      "The AI agent has taken several steps but hasn't reached a conclusion yet. Do you want to continue?",
    app_request_failed: "Request failed: {0}",
    // ui/WelcomeScreen.tsx
    welcome_label_model: "Model",
    welcome_label_thinking: "Thinking Enabled",
    welcome_label_effort: "Reasoning Effort",
    welcome_label_cwd: "CWD",
    welcome_tips_prefix: "Tips: ",
    welcome_shortcut_enter: "Send the prompt",
    welcome_shortcut_shift_enter: "Insert a newline",
    welcome_shortcut_ctrl_v: "Paste an image from the clipboard",
    welcome_shortcut_esc: "Interrupt the current model turn",
    welcome_shortcut_slash: "Open the skills and commands menu",
    welcome_shortcut_ctrl_d: "Quit Deep Code CLI",
    welcome_tip_rg_jq:
      "Deep Code will auto-prepare local rg and jq binaries to boost Bash exploration signal and information density",
    welcome_tip_rg_jq_ready:
      "Local rg and jq binaries are ready for Bash exploration without changing your system environment",
    // ui/slashCommands.ts
    slash_skills: "List available skills",
    slash_goal: "Set a long-running goal and let the agent keep working",
    slash_compact: "Summarize old context to free up space in the context window",
    slash_diff: "Show the current git diff inline in the conversation",
    slash_copy: "Copy the last assistant response to the clipboard",
    slash_clear: "Clear the terminal screen",
    slash_context: "Show context window token usage for the current session",
    slash_init: "Generate an AGENTS.md for this project",
    slash_new: "Start a fresh conversation",
    slash_resume: "Pick a previous conversation to continue",
    slash_exit: "Quit Deep Code CLI",
    slash_no_desc: "(no description)",
    slash_model: "Switch AI model (usage: /model <name>)",
    slash_thinking: "Toggle thinking mode on/off",
    slash_effort: "Switch reasoning effort: high or max",
    slash_cwd: "Change working directory (usage: /cwd <path>)",
    slash_skill: "Create a new project skill (usage: /skill <name>)",
    slash_mcp: "Add an MCP server config (usage: /mcp <name> <command> [args...])",
    slash_key: "Update API key (usage: /key <api_key>)",
    slash_qwenkey: "Update Qwen API key for multimodal (usage: /qwenkey <api_key>)",
    slash_settings: "Show current key/model/thinking/effort/cwd/tool status",
    slash_mode: "Switch permission mode: plan | accept-edits | bypass-permissions (usage: /mode <mode>)",
    slash_todos: "Toggle TODO panel visibility",
    // app mode command feedback
    app_mode_current: "Current permission mode: **{0}**\nUsage: `/mode plan|accept-edits|bypass-permissions`",
    app_mode_changed: "Permission mode set to: **{0}**",
    app_mode_invalid: "Invalid mode. Use: `plan`, `accept-edits`, or `bypass-permissions`",
    // app settings command feedback
    app_model_current: "Current model: **{0}**\nUsage: `/model <name>`",
    app_model_changed: "Model switched to: **{0}**",
    app_thinking_on: "Thinking mode: **enabled**",
    app_thinking_off: "Thinking mode: **disabled**",
    app_effort_current: "Current reasoning effort: **{0}**\nUsage: `/effort high|max`",
    app_effort_changed: "Reasoning effort set to: **{0}**",
    app_effort_invalid: "Invalid value. Use: `high` or `max`",
    app_cwd_current: "Current directory: `{0}`\nUsage: `/cwd <path>`",
    app_cwd_changed: "Working directory changed to: `{0}`\nUse `/new` to start a new session here.",
    app_cwd_invalid: "Directory not found: `{0}`",
    app_skill_usage: "Usage: `/skill <name>`",
    app_skill_exists: "Skill already exists: `{0}`",
    app_skill_created: "Skill created: `{0}`\nReload with `/new` to activate it.",
    app_skill_failed: "Failed to create skill: {0}",
    app_mcp_usage: "Usage: `/mcp <name> <command> [args...]`\nExample: `/mcp filesystem npx @modelcontextprotocol/server-filesystem /path`",
    app_mcp_added: "MCP server **{0}** added to settings.\nReload with `/new` to activate it.",
    app_mcp_failed: "Failed to add MCP server: {0}",
    app_key_usage: "Usage: `/key <api_key>`",
    app_key_updated: "API key updated successfully.",
    app_key_failed: "Failed to update API key: {0}",
    app_qwenkey_usage: "Usage: `/qwenkey <api_key>`",
    app_qwenkey_updated: "Qwen API key updated successfully.",
    app_qwenkey_failed: "Failed to update Qwen API key: {0}",
    app_settings_key_set: "configured",
    app_settings_key_unset: "not configured",
    app_settings_enabled: "enabled",
    app_settings_disabled: "disabled",
    app_settings_tool_ready: "ready",
    app_settings_tool_missing: "missing",
    app_settings_summary:
      "**Current Settings**\n- API key: **{0}**\n- Model: **{1}**\n- Base URL: `{2}`\n- Thinking: **{3}**\n- Reasoning effort: **{4}**\n- Working directory: `{5}`\n- Local tools: {6}",
    // ui/exitSummary.ts
    exit_goodbye: "Goodbye!",
    exit_model_usage: "Model Usage",
    exit_col_reqs: "Reqs",
    exit_col_input: "Input Tokens",
    exit_col_output: "Output Tokens",
    exit_col_cached: "Cached Tokens",
    // ui/loadingText.ts
    loading_thinking: "Thinking...",
    loading_thinking_long: "Thinking... ({0}s) \u00b7 \u2193 {1} tokens",
    // session.ts – user-visible messages
    session_no_api_client: "No API client configured.",
    session_api_key_missing: "API key not configured",
    session_empty_content: "Model returned empty content.",
    session_tool_incomplete: "Previous tool call did not complete.",
    session_connection_error_hint:
      "Connection error. Check network/proxy/TLS settings for {0}.",
    session_tls_error_hint:
      "TLS certificate validation failed when connecting to {0}. If your network uses HTTPS interception, configure `NODE_EXTRA_CA_CERTS` to your org root certificate and restart. Temporary workaround (unsafe): `NODE_TLS_REJECT_UNAUTHORIZED=0`.",
    session_interrupted: "Interrupted.",
    session_killed_processes: "Killed processes: {0}.",
    session_kill_failed: "Failed to kill processes: {0}.",
  },

  zh: {
    // cli.tsx – help text
    cli_title: "deepcode - Deep Code \u547d\u4ee4\u884c\u5de5\u5177",
    cli_usage: "\u7528\u6cd5\uff1a",
    cli_usage_tui:
      "  deepcode               \u5728\u5f53\u524d\u76ee\u5f55\u542f\u52a8\u4ea4\u4e92\u5f0f\u754c\u9762",
    cli_usage_print:
      "  deepcode -p <\u63d0\u793a>     \u975e\u4ea4\u4e92\u6a21\u5f0f\uff1a\u53d1\u9001\u5355\u6b21\u63d0\u793a\u540e\u9000\u51fa",
    cli_usage_continue:
      "  deepcode --continue    \u6062\u590d\u6700\u8fd1\u7684\u4f1a\u8bdd\uff08\u4ea4\u4e92\u6a21\u5f0f\uff09",
    cli_usage_version: "  deepcode --version     \u663e\u793a\u7248\u672c\u53f7",
    cli_usage_help: "  deepcode --help        \u663e\u793a\u6b64\u5e2e\u52a9",
    cli_config_header: "\u914d\u7f6e\u6587\u4ef6\uff1a",
    cli_config_settings:
      "  ~/.deepcode/settings.json   API \u5bc6\u9470\u3001\u6a21\u578b\u3001\u57fa\u7840 URL",
    cli_config_user_skills:
      "  ~/.agents/skills/*/SKILL.md  \u7528\u6237\u7ea7\u6280\u80fd",
    cli_config_project_skills:
      "  ./.deepcode/skills/*/SKILL.md \u9879\u76ee\u7ea7\u6280\u80fd",
    cli_config_agents:
      "  ./AGENTS.md              \u9879\u76ee\u7ea7 Agent \u6307\u4ee4",
    cli_tui_header: "TUI \u5feb\u6377\u952e\uff1a",
    cli_tui_enter: "  enter            \u53d1\u9001\u63d0\u793a",
    cli_tui_shift_enter: "  shift+enter      \u63d2\u5165\u6362\u884c",
    cli_tui_home_end: "  home/end         \u5728\u5f53\u524d\u884c\u5185\u79fb\u52a8",
    cli_tui_alt_arrows: "  alt+\u5de6/\u53f3        \u6309\u8bcd\u79fb\u52a8",
    cli_tui_ctrl_w: "  ctrl+w           \u5220\u9664\u4e0a\u4e00\u4e2a\u5355\u8bcd",
    cli_tui_ctrl_v: "  ctrl+v           \u4ece\u526a\u8d34\u677f\u7c98\u8d34\u56fe\u7247",
    cli_tui_ctrl_x: "  ctrl+x           \u6e05\u9664\u5df2\u7c98\u8d34\u7684\u56fe\u7247",
    cli_tui_esc: "  esc              \u4e2d\u65ad\u5f53\u524d\u6a21\u578b\u54cd\u5e94",
    cli_tui_esc_empty:
      "  esc (\u7a7a\u8f93\u5165)     \u9884\u5907\u56de\u9000\uff08\u518d\u6b21\u6309 esc \u64a4\u9500\u4e0a\u4e00\u8f6e\u5bf9\u8bdd\uff09",
    cli_tui_hash:
      "  # <\u5907\u6ce8>         \u4fdd\u5b58\u5907\u6ce8\u5230 AGENTS.md\uff0c\u4e0d\u53d1\u9001\u7ed9\u6a21\u578b",
    cli_tui_slash: "  /                \u6253\u5f00\u6280\u80fd/\u547d\u4ee4\u83dc\u5355",
    cli_tui_compact: "  /compact         \u624b\u52a8\u538b\u7f29\u4e0a\u4e0b\u6587\u7a97\u53e3",
    cli_tui_context:
      "  /context         \u663e\u793a\u4e0a\u4e0b\u6587\u7a97\u53e3 Token \u7528\u91cf",
    cli_tui_diff: "  /diff            \u5185\u8054\u663e\u793a git diff",
    cli_tui_copy:
      "  /copy            \u590d\u5236\u6700\u540e\u4e00\u6761\u56de\u590d\u5230\u526a\u8d34\u677f",
    cli_tui_clear: "  /clear           \u6e05\u5c4f",
    cli_tui_init: "  /init            \u4e3a\u6b64\u9879\u76ee\u751f\u6210 AGENTS.md",
    cli_tui_model: "  /model <\u540d\u79f0>  \u5207\u6362 AI \u6a21\u578b",
    cli_tui_thinking: "  /thinking on|off \u5f00\u5173\u601d\u8003\u6a21\u5f0f",
    cli_tui_effort: "  /effort high|max \u8bbe\u7f6e\u63a8\u7406\u5f3a\u5ea6",
    cli_tui_cwd: "  /cwd <\u8def\u5f84>     \u5207\u6362\u5de5\u4f5c\u76ee\u5f55",
    cli_tui_key: "  /key <api_key>   \u66f4\u65b0 API \u5bc6\u9470",
    cli_tui_settings: "  /settings        \u663e\u793a\u5f53\u524d\u8fd0\u884c\u65f6\u8bbe\u7f6e",
    cli_tui_new: "  /new             \u5f00\u59cb\u65b0\u5bf9\u8bdd",
    cli_tui_resume: "  /resume          \u9009\u62e9\u5386\u53f2\u5bf9\u8bdd\u7ee7\u7eed",
    cli_tui_exit: "  /exit            \u9000\u51fa",
    cli_tui_ctrl_d: "  ctrl+d \u4e24\u6b21      \u9000\u51fa",
    // cli.tsx – errors & setup
    cli_err_print_no_prompt:
      "deepcode -p/--print\uff1a\u8bf7\u901a\u8fc7\u53c2\u6570\u6216\u6807\u51c6\u8f93\u5165\u63d0\u4f9b\u63d0\u793a\u8bcd\u3002",
    cli_err_no_tty:
      "deepcode \u9700\u8981\u4ea4\u4e92\u5f0f\u7ec8\u7aef\uff08TTY\uff09\uff0c\u8bf7\u5728\u771f\u5b9e\u7ec8\u7aef\u4e2d\u8fd0\u884c\u3002",
    cli_err_empty_prompt: "deepcode -p\uff1a\u63d0\u793a\u8bcd\u4e0d\u80fd\u4e3a\u7a7a\u3002",
    cli_setup_no_key:
      "\u672a\u627e\u5230 API \u5bc6\u9470\u3002\u8bf7\u8f93\u5165\u60a8\u7684 DeepSeek API \u5bc6\u9470\u4ee5\u5f00\u59cb\u4f7f\u7528\u3002",
    cli_setup_save_to: "\uff08\u5c06\u4fdd\u5b58\u5230 {0}\uff09",
    cli_setup_prompt: "API \u5bc6\u9470\uff1a",
    cli_setup_required:
      "API \u5bc6\u9470\u4e3a\u5fc5\u586b\u9879\uff0c\u7a0b\u5e8f\u9000\u51fa\u3002",
    cli_setup_saved:
      "API \u5bc6\u9470\u5df2\u4fdd\u5b58\uff0c\u6b63\u5728\u542f\u52a8 Deep Code CLI...",
    // ui/App.tsx – feedback messages
    app_copied: "\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f\u3002",
    app_copy_failed:
      "\u65e0\u6cd5\u5199\u5165\u526a\u8d34\u677f\u3002\u8bf7\u786e\u4fdd\u7cfb\u7edf\u5df2\u5b89\u88c5\u526a\u8d34\u677f\u5de5\u5177\uff08pbcopy\u3001xclip/xsel/wl-copy \u6216 PowerShell\uff09\u3002",
    app_copy_nothing: "\u6682\u65e0\u53ef\u590d\u5236\u7684\u52a9\u624b\u56de\u590d\u3002",
    app_diff_no_changes: "\uff08\u65e0\u672a\u63d0\u4ea4\u7684\u66f4\u6539\uff09",
    app_diff_no_git: "\uff08\u975e Git \u4ed3\u5e93\u6216 git \u4e0d\u53ef\u7528\uff09",
    app_compact_no_session:
      "\u6ca1\u6709\u53ef\u538b\u7f29\u7684\u6d3b\u52a8\u4f1a\u8bdd\u3002",
    app_compacting: "\u6b63\u5728\u538b\u7f29\u5bf9\u8bdd\u2026",
    app_compacted: "\u5bf9\u8bdd\u5df2\u538b\u7f29\u3002",
    app_compact_failed: "\u538b\u7f29\u5931\u8d25\uff1a{0}",
    app_context_no_session: "\u6ca1\u6709\u6d3b\u52a8\u4f1a\u8bdd\u3002",
    app_context_header: "**\u4e0a\u4e0b\u6587\u7a97\u53e3\u7528\u91cf**",
    app_context_active_tokens:
      "- \u6d3b\u8dc3 Token \u6570\uff08\u4e0a\u6b21\u54cd\u5e94\uff09\uff1a{0}",
    app_context_total_tokens:
      "- \u5df2\u7528 Token \u603b\u6570\uff08\u672c\u6b21\u4f1a\u8bdd\uff09\uff1a{0}",
    app_context_tip:
      "_\u63d0\u793a\uff1a\u4f7f\u7528 `/compact` \u91ca\u653e\u4e0a\u4e0b\u6587\u7a97\u53e3\u7a7a\u95f4\u3002_",
    app_note_saved: '\u5df2\u4fdd\u5b58\u5230 AGENTS.md\uff1a_"{0}"_',
    app_note_failed:
      "\u65e0\u6cd5\u5199\u5165 AGENTS.md\uff0c\u8bf7\u68c0\u67e5\u6587\u4ef6\u6743\u9650\u3002",
    app_agents_exists:
      "`{0}` \u5df2\u5b58\u5728 AGENTS.md\u3002\u8bf7\u624b\u52a8\u7f16\u8f91\u6216\u5148\u5220\u9664\u5b83\u3002",
    app_agents_generating:
      "\u6b63\u5728\u4e3a\u6b64\u9879\u76ee\u751f\u6210 AGENTS.md\u2026",
    app_agents_created:
      "\u5df2\u521b\u5efa `{0}`\uff0c\u5c06\u5728\u4e0b\u6b21\u4f1a\u8bdd\u542f\u52a8\u65f6\u52a0\u8f7d\u3002",
    app_agents_failed: "\u751f\u6210 AGENTS.md \u5931\u8d25\uff1a{0}",
    app_no_api_key:
      "\u672a\u914d\u7f6e API \u5bc6\u9470\uff0c\u8bf7\u91cd\u542f CLI \u4ee5\u8f93\u5165 API \u5bc6\u9470\u3002",
    app_compacting_long:
      "\u5bf9\u8bdd\u5185\u5bb9\u8fc7\u957f\uff0c\u6b63\u5728\u81ea\u52a8\u538b\u7f29...",
    app_continue_question:
      "AI Agent \u5df2\u6267\u884c\u591a\u6b65\u64cd\u4f5c\u4f46\u5c1a\u672a\u5f97\u51fa\u7ed3\u8bba\uff0c\u662f\u5426\u7ee7\u7eed\uff1f",
    app_request_failed: "\u8bf7\u6c42\u5931\u8d25\uff1a{0}",
    // ui/WelcomeScreen.tsx
    welcome_label_model: "\u6a21\u578b",
    welcome_label_thinking: "\u601d\u8003\u6a21\u5f0f",
    welcome_label_effort: "\u63a8\u7406\u5f3a\u5ea6",
    welcome_label_cwd: "\u5de5\u4f5c\u76ee\u5f55",
    welcome_tips_prefix: "\u63d0\u793a\uff1a",
    welcome_shortcut_enter: "\u53d1\u9001\u63d0\u793a",
    welcome_shortcut_shift_enter: "\u63d2\u5165\u6362\u884c",
    welcome_shortcut_ctrl_v: "\u4ece\u526a\u8d34\u677f\u7c98\u8d34\u56fe\u7247",
    welcome_shortcut_esc: "\u4e2d\u65ad\u5f53\u524d\u6a21\u578b\u54cd\u5e94",
    welcome_shortcut_slash: "\u6253\u5f00\u6280\u80fd\u4e0e\u547d\u4ee4\u83dc\u5355",
    welcome_shortcut_ctrl_d: "\u9000\u51fa Deep Code CLI",
    welcome_tip_rg_jq:
      "Deep Code \u4f1a\u81ea\u52a8\u51c6\u5907\u672c\u5730 rg \u548c jq \u4e8c\u8fdb\u5236\u6587\u4ef6\uff0c\u4ee5\u63d0\u5347 Bash \u63a2\u7d22\u6548\u7387\u548c\u4fe1\u606f\u5bc6\u5ea6",
    welcome_tip_rg_jq_ready:
      "\u672c\u5730 rg \u548c jq \u5df2\u5c31\u7eea\uff0c\u53ef\u7528\u4e8e Bash \u63a2\u7d22\uff0c\u4e14\u4e0d\u4f1a\u4fee\u6539\u7cfb\u7edf\u73af\u5883\u53d8\u91cf",
    // ui/slashCommands.ts
    slash_skills: "\u5217\u51fa\u53ef\u7528\u6280\u80fd",
    slash_goal: "\u8bbe\u5b9a\u957f\u671f\u76ee\u6807\uff0c\u8ba9 Agent \u6301\u7eed\u6267\u884c",
    slash_compact:
      "\u538b\u7f29\u65e7\u4e0a\u4e0b\u6587\u4ee5\u91ca\u653e\u4e0a\u4e0b\u6587\u7a97\u53e3\u7a7a\u95f4",
    slash_diff: "\u5728\u5bf9\u8bdd\u4e2d\u5185\u8054\u663e\u793a\u5f53\u524d git diff",
    slash_copy:
      "\u5c06\u6700\u540e\u4e00\u6761\u52a9\u624b\u56de\u590d\u590d\u5236\u5230\u526a\u8d34\u677f",
    slash_clear: "\u6e05\u9664\u7ec8\u7aef\u5c4f\u5e55",
    slash_context:
      "\u663e\u793a\u5f53\u524d\u4f1a\u8bdd\u7684\u4e0a\u4e0b\u6587\u7a97\u53e3 Token \u7528\u91cf",
    slash_init: "\u4e3a\u6b64\u9879\u76ee\u751f\u6210 AGENTS.md",
    slash_new: "\u5f00\u59cb\u65b0\u5bf9\u8bdd",
    slash_resume: "\u9009\u62e9\u5386\u53f2\u5bf9\u8bdd\u7ee7\u7eed",
    slash_exit: "\u9000\u51fa Deep Code CLI",
    slash_no_desc: "\uff08\u6682\u65e0\u63cf\u8ff0\uff09",
    slash_model: "\u5207\u6362 AI \u6a21\u578b\uff08\u7528\u6cd5\uff1a/model <\u540d\u79f0>\uff09",
    slash_thinking: "\u5f00\u5173\u601d\u8003\u6a21\u5f0f",
    slash_effort: "\u5207\u6362\u63a8\u7406\u5f3a\u5ea6\uff1ahigh \u6216 max",
    slash_cwd: "\u5207\u6362\u5de5\u4f5c\u76ee\u5f55\uff08\u7528\u6cd5\uff1a/cwd <\u8def\u5f84>\uff09",
    slash_skill: "\u521b\u5efa\u9879\u76ee\u6280\u80fd\uff08\u7528\u6cd5\uff1a/skill <\u540d\u79f0>\uff09",
    slash_mcp: "\u6dfb\u52a0 MCP \u670d\u52a1\u5668\u914d\u7f6e\uff08\u7528\u6cd5\uff1a/mcp <\u540d\u79f0> <\u547d\u4ee4> [\u53c2\u6570...]\uff09",
    slash_key: "\u66f4\u65b0 API \u5bc6\u94a5\uff08\u7528\u6cd5\uff1a/key <api_key>\uff09",
    slash_qwenkey: "\u66f4\u65b0 Qwen \u591a\u6a21\u6001 API \u5bc6\u94a5\uff08\u7528\u6cd5\uff1a/qwenkey <api_key>\uff09",
    slash_settings: "\u663e\u793a key\u3001\u6a21\u578b\u3001\u601d\u8003\u3001\u63a8\u7406\u3001CWD \u548c\u5de5\u5177\u72b6\u6001",
    slash_mode: "\u5207\u6362\u6743\u9650\u6a21\u5f0f\uff1aplan | accept-edits | bypass-permissions\uff08\u7528\u6cd5\uff1a/mode <\u6a21\u5f0f>\uff09",
    slash_todos: "\u5207\u6362 TODO \u9762\u677f\u53ef\u89c1\u6027",
    // app mode command feedback
    app_mode_current: "\u5f53\u524d\u6743\u9650\u6a21\u5f0f\uff1a**{0}**\n\u7528\u6cd5\uff1a`/mode plan|accept-edits|bypass-permissions`",
    app_mode_changed: "\u6743\u9650\u6a21\u5f0f\u5df2\u8bbe\u4e3a\uff1a**{0}**",
    app_mode_invalid: "\u65e0\u6548\u6a21\u5f0f\u3002\u8bf7\u4f7f\u7528\uff1a`plan`\u3001`accept-edits` \u6216 `bypass-permissions`",
    // app settings command feedback
    app_model_current: "\u5f53\u524d\u6a21\u578b\uff1a**{0}**\n\u7528\u6cd5\uff1a`/model <\u540d\u79f0>`",
    app_model_changed: "\u6a21\u578b\u5df2\u5207\u6362\u4e3a\uff1a**{0}**",
    app_thinking_on: "\u601d\u8003\u6a21\u5f0f\uff1a**\u5df2\u5f00\u542f**",
    app_thinking_off: "\u601d\u8003\u6a21\u5f0f\uff1a**\u5df2\u5173\u95ed**",
    app_effort_current: "\u5f53\u524d\u63a8\u7406\u5f3a\u5ea6\uff1a**{0}**\n\u7528\u6cd5\uff1a`/effort high|max`",
    app_effort_changed: "\u63a8\u7406\u5f3a\u5ea6\u5df2\u8bbe\u4e3a\uff1a**{0}**",
    app_effort_invalid: "\u65e0\u6548\u503c\uff0c\u8bf7\u4f7f\u7528\uff1a`high` \u6216 `max`",
    app_cwd_current: "\u5f53\u524d\u76ee\u5f55\uff1a`{0}`\n\u7528\u6cd5\uff1a`/cwd <\u8def\u5f84>`",
    app_cwd_changed: "\u5de5\u4f5c\u76ee\u5f55\u5df2\u5207\u6362\u5230\uff1a`{0}`\n\u4f7f\u7528 `/new` \u5728\u6b64\u76ee\u5f55\u5f00\u59cb\u65b0\u4f1a\u8bdd\u3002",
    app_cwd_invalid: "\u76ee\u5f55\u4e0d\u5b58\u5728\uff1a`{0}`",
    app_skill_usage: "\u7528\u6cd5\uff1a`/skill <\u540d\u79f0>`",
    app_skill_exists: "\u6280\u80fd\u5df2\u5b58\u5728\uff1a`{0}`",
    app_skill_created: "\u6280\u80fd\u5df2\u521b\u5efa\uff1a`{0}`\n\u4f7f\u7528 `/new` \u91cd\u65b0\u52a0\u8f7d\u4ee5\u6fc0\u6d3b\u3002",
    app_skill_failed: "\u521b\u5efa\u6280\u80fd\u5931\u8d25\uff1a{0}",
    app_mcp_usage: "\u7528\u6cd5\uff1a`/mcp <\u540d\u79f0> <\u547d\u4ee4> [\u53c2\u6570...]`\n\u793a\u4f8b\uff1a`/mcp filesystem npx @modelcontextprotocol/server-filesystem /path`",
    app_mcp_added: "MCP \u670d\u52a1\u5668 **{0}** \u5df2\u6dfb\u52a0\u5230\u8bbe\u7f6e\u3002\n\u4f7f\u7528 `/new` \u91cd\u65b0\u52a0\u8f7d\u4ee5\u6fc0\u6d3b\u3002",
    app_mcp_failed: "\u6dfb\u52a0 MCP \u670d\u52a1\u5668\u5931\u8d25\uff1a{0}",
    app_key_usage: "\u7528\u6cd5\uff1a`/key <api_key>`",
    app_key_updated: "API \u5bc6\u94a5\u5df2\u6210\u529f\u66f4\u65b0\u3002",
    app_key_failed: "\u66f4\u65b0 API \u5bc6\u94a5\u5931\u8d25\uff1a{0}",
    app_qwenkey_usage: "\u7528\u6cd5\uff1a`/qwenkey <api_key>`",
    app_qwenkey_updated: "Qwen API \u5bc6\u94a5\u5df2\u6210\u529f\u66f4\u65b0\u3002",
    app_qwenkey_failed: "\u66f4\u65b0 Qwen API \u5bc6\u94a5\u5931\u8d25\uff1a{0}",
    app_settings_key_set: "\u5df2\u914d\u7f6e",
    app_settings_key_unset: "\u672a\u914d\u7f6e",
    app_settings_enabled: "\u5df2\u5f00\u542f",
    app_settings_disabled: "\u5df2\u5173\u95ed",
    app_settings_tool_ready: "\u5df2\u5c31\u7eea",
    app_settings_tool_missing: "\u7f3a\u5931",
    app_settings_summary:
      "**\u5f53\u524d\u8bbe\u7f6e**\n- API key\uff1a**{0}**\n- \u6a21\u578b\uff1a**{1}**\n- Base URL\uff1a`{2}`\n- \u601d\u8003\uff1a**{3}**\n- \u63a8\u7406\u5f3a\u5ea6\uff1a**{4}**\n- \u5de5\u4f5c\u76ee\u5f55\uff1a`{5}`\n- \u672c\u5730\u5de5\u5177\uff1a{6}",
    // ui/exitSummary.ts
    exit_goodbye: "\u518d\u89c1\uff01",
    exit_model_usage: "\u6a21\u578b\u7528\u91cf",
    exit_col_reqs: "\u8bf7\u6c42\u6570",
    exit_col_input: "\u8f93\u5165 Token",
    exit_col_output: "\u8f93\u51fa Token",
    exit_col_cached: "\u7f13\u5b58 Token",
    // ui/loadingText.ts
    loading_thinking: "\u601d\u8003\u4e2d...",
    loading_thinking_long: "\u601d\u8003\u4e2d... ({0}s) \u00b7 \u2193 {1} tokens",
    // session.ts – user-visible messages
    session_no_api_client: "\u672a\u914d\u7f6e API \u5ba2\u6237\u7aef\u3002",
    session_api_key_missing: "\u672a\u914d\u7f6e API \u5bc6\u9470",
    session_empty_content: "\u6a21\u578b\u8fd4\u56de\u4e86\u7a7a\u5185\u5bb9\u3002",
    session_tool_incomplete: "\u4e0a\u4e00\u6b21\u5de5\u5177\u8c03\u7528\u672a\u5b8c\u6210\u3002",
    session_connection_error_hint:
      "\u8fde\u63a5\u5931\u8d25\u3002\u8bf7\u68c0\u67e5 {0} \u7684\u7f51\u7edc/\u4ee3\u7406/TLS \u8bbe\u7f6e\u3002",
    session_tls_error_hint:
      "\u8fde\u63a5 {0} \u65f6 TLS \u8bc1\u4e66\u6821\u9a8c\u5931\u8d25\u3002\u82e5\u6240\u5728\u7f51\u7edc\u4f7f\u7528 HTTPS \u68c0\u67e5\u4ee3\u7406\uff0c\u8bf7\u914d\u7f6e `NODE_EXTRA_CA_CERTS` \u6307\u5411\u7ec4\u7ec7\u6839\u8bc1\u4e66\u540e\u91cd\u542f\u3002\u4e34\u65f6\u89e3\u6cd5\uff08\u4e0d\u5b89\u5168\uff09\uff1a`NODE_TLS_REJECT_UNAUTHORIZED=0`\u3002",
    session_interrupted: "\u5df2\u4e2d\u65ad\u3002",
    session_killed_processes: "\u5df2\u7ec8\u6b62\u8fdb\u7a0b\uff1a{0}\u3002",
    session_kill_failed: "\u7ec8\u6b62\u8fdb\u7a0b\u5931\u8d25\uff1a{0}\u3002",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

let _locale: Locale = detectLocale();

export function setLocale(locale: Locale): void {
  _locale = locale;
}

export function getLocale(): Locale {
  return _locale;
}

export function t(key: TranslationKey, ...args: Array<string | number>): string {
  const dict = translations[_locale] as Record<string, string>;
  const fallback = translations.en as Record<string, string>;
  const str = dict[key] ?? fallback[key] ?? key;
  return args.reduce<string>((s, arg, i) => s.replace(`{${i}}`, String(arg)), str);
}
