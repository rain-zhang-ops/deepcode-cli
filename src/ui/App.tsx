import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Static, Text, useApp, useStdout } from "ink";
import chalk from "chalk";
import * as fs from "fs";
import * as os from "os";
import { t } from "../i18n";
import * as path from "path";
import { execSync } from "child_process";
import OpenAI from "openai";
import { getSettingsService } from "../services/SettingsService";
import { getSessionWorkingDirectory, setSessionWorkingDirectory } from "../tools/bash-handler";
import { getRecommendedCliToolsStatus } from "../tools/managed-tools";
import {
  SessionManager,
  type LlmStreamProgress,
  type SessionEntry,
  type SessionMessage,
  type SessionStatus,
  type SkillInfo,
  type UserPromptContent
} from "../session";
import { resolveSettings, type DeepcodingSettings } from "../settings";
import type { McpServerConfig } from "../settings";
import { PromptInput, type PromptSubmission } from "./PromptInput";
import { MessageView } from "./MessageView";
import { SessionList } from "./SessionList";
import { buildLoadingText } from "./loadingText";
import { findExpandedThinkingId } from "./thinkingState";
import { WelcomeScreen } from "./WelcomeScreen";
import { AskUserQuestionPrompt } from "./AskUserQuestionPrompt";
import {
  findPendingAskUserQuestion,
  formatAskUserQuestionAnswers,
  type AskUserQuestionAnswers
} from "./askUserQuestion";
import { buildExitSummaryText } from "./exitSummary";
import { writeClipboardText } from "./clipboard";

const GOAL_MODE_INSTRUCTIONS = [
  "Operate in autonomous goal mode: keep taking concrete actions toward the goal.",
  "If one turn ends before the goal is complete, continue proactively in subsequent turns until completion or user interruption."
].join("\n");

type View = "chat" | "session-list";

type AppProps = {
  projectRoot: string;
  version?: string;
  resumeSessionId?: string;
  onRestart?: () => void;
};

export function App({ projectRoot, version = "", resumeSessionId, onRestart }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout, write } = useStdout();
  const [view, setView] = useState<View>("chat");
  const [busy, setBusy] = useState(false);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [statusLine, setStatusLine] = useState<string>("");
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState<LlmStreamProgress | null>(null);
  const [runningProcesses, setRunningProcesses] = useState<SessionEntry["processes"]>(null);
  const [activeStatus, setActiveStatus] = useState<SessionStatus | null>(null);
  const [dismissedQuestionIds, setDismissedQuestionIds] = useState<Set<string>>(() => new Set());
  const [isExiting, setIsExiting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [, setNowTick] = useState(0);
  const turnStartRef = useRef<number>(0);

  const messagesRef = useRef<SessionMessage[]>([]);
  messagesRef.current = messages;

  const sessionManager = useMemo(() => {
    return new SessionManager({
      projectRoot,
      createOpenAIClient: () => createOpenAIClient(),
      getResolvedSettings: () => getSettingsService().getResolvedSettings(),
      renderMarkdown: (text) => text,
      onAssistantMessage: (message: SessionMessage) => {
        setMessages((prev) => [...prev, message]);
      },
      onSessionEntryUpdated: (entry) => {
        setStatusLine(buildStatusLine(entry));
        setRunningProcesses(entry.processes);
        setActiveStatus(entry.status);
      },
      onLlmStreamProgress: (progress) => {
        if (progress.phase === "end") {
          setStreamProgress(null);
          return;
        }
        setStreamProgress(progress);
      }
    });
  }, [projectRoot]);

  useEffect(() => {
    if (!busy) {
      return;
    }
    const id = setInterval(() => setNowTick((tick) => tick + 1), 500);
    return () => clearInterval(id);
  }, [busy]);

  useEffect(() => {
    refreshSessionsList();
    void refreshSkills();
    // Resume a specific session when provided via --continue flag
    if (resumeSessionId) {
      sessionManager.setActiveSessionId(resumeSessionId);
      setMessages(loadVisibleMessages(sessionManager, resumeSessionId));
      const session = sessionManager.getSession(resumeSessionId);
      setStatusLine(session ? buildStatusLine(session) : "");
      setRunningProcesses(session?.processes ?? null);
      setActiveStatus(session?.status ?? null);
      setShowWelcome(false);
      setView("chat");
      void refreshSkills(resumeSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadVisibleMessages(manager: SessionManager, sessionId: string): SessionMessage[] {
    return manager.listSessionMessages(sessionId).filter((m) => m.visible);
  }

  function refreshSessionsList(): void {
    setSessions(sessionManager.listSessions());
  }

  async function refreshSkills(sessionId?: string): Promise<void> {
    try {
      const list = await sessionManager.listSkills(sessionId ?? sessionManager.getActiveSessionId() ?? undefined);
      setSkills(list);
    } catch {
      // ignore
    }
  }

  const handlePrompt = useCallback(
    async (submission: PromptSubmission) => {
      if (submission.command === "exit") {
        setIsExiting(true);
        setTimeout(() => {
          const activeSessionId = sessionManager.getActiveSessionId();
          const session = activeSessionId ? sessionManager.getSession(activeSessionId) : null;
          const allMessages = activeSessionId
            ? sessionManager.listSessionMessages(activeSessionId)
            : messagesRef.current;
          const resolved = getSettingsService().getResolvedSettings();
          const summary = buildExitSummaryText({ session, messages: allMessages, model: resolved.model });
          process.stdout.write("\n");
          process.stdout.write(chalk.green("> /exit "));
          process.stdout.write("\n\n");
          process.stdout.write(summary);
          process.stdout.write("\n\n");
          exit();
        }, 0);
        return;
      }
      if (submission.command === "new") {
        if (onRestart) {
          onRestart();
        } else {
          write("\u001B[2J\u001B[3J\u001B[H");
          sessionManager.setActiveSessionId(null);
          setMessages([]);
          setStatusLine("");
          setErrorLine(null);
          setRunningProcesses(null);
          setActiveStatus(null);
          setDismissedQuestionIds(new Set());
          setShowWelcome(true);
          await refreshSkills();
          refreshSessionsList();
        }
        return;
      }
      if (submission.command === "resume") {
        setShowWelcome(false);
        refreshSessionsList();
        setView("session-list");
        return;
      }
      if (submission.command === "clear") {
        write("\u001B[2J\u001B[3J\u001B[H");
        return;
      }
      if (submission.command === "copy") {
        const lastAssistant = [...messagesRef.current]
          .reverse()
          .find((m) => m.role === "assistant" && typeof m.content === "string" && m.content.trim());
        if (lastAssistant && typeof lastAssistant.content === "string") {
          const ok = writeClipboardText(lastAssistant.content);
          setMessages((prev) => [
            ...prev,
            buildSyntheticAssistantMessage(ok ? t("app_copied") : t("app_copy_failed"))
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            buildSyntheticAssistantMessage(t("app_copy_nothing"))
          ]);
        }
        return;
      }
      if (submission.command === "diff") {
        let diffOutput: string;
        try {
          diffOutput = execSync("git diff", { cwd: projectRoot, encoding: "utf8" });
          if (!diffOutput.trim()) {
            diffOutput = t("app_diff_no_changes");
          }
        } catch {
          diffOutput = t("app_diff_no_git");
        }
        setMessages((prev) => [
          ...prev,
          buildSyntheticAssistantMessage(`\`\`\`diff\n${diffOutput}\n\`\`\``)
        ]);
        return;
      }
      if (submission.command === "compact") {
        const activeSessionId = sessionManager.getActiveSessionId();
        if (!activeSessionId) {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_compact_no_session"))]);
          return;
        }
        const compactMsg = buildSyntheticAssistantMessage(t("app_compacting"));
        setMessages((prev) => [...prev, compactMsg]);
        setBusy(true);
        setErrorLine(null);
        try {
          await sessionManager.compactSession(activeSessionId);
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== compactMsg.id),
            buildSyntheticAssistantMessage(t("app_compacted"))
          ]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== compactMsg.id),
            buildSyntheticAssistantMessage(t("app_compact_failed", message))
          ]);
        } finally {
          setBusy(false);
        }
        return;
      }
      if (submission.command === "backtrack") {
        const activeSessionId = sessionManager.getActiveSessionId();
        if (activeSessionId) {
          sessionManager.rollbackLastExchange(activeSessionId);
          const updated = sessionManager.listSessionMessages(activeSessionId).filter((m) => m.visible);
          setMessages(updated);
          setStatusLine("");
        } else {
          // If no session just clear the visible message list
          setMessages([]);
        }
        return;
      }
      if (submission.command === "context") {
        const activeSessionId = sessionManager.getActiveSessionId();
        if (!activeSessionId) {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_context_no_session"))]);
          return;
        }
        const entry = sessionManager.getSession(activeSessionId);
        const tokens = entry?.activeTokens ?? 0;
        const totalUsage = entry?.usage;
        let totalTokens = 0;
        if (totalUsage && typeof totalUsage === "object") {
          const u = totalUsage as Record<string, unknown>;
          if (typeof u.total_tokens === "number") {
            totalTokens = u.total_tokens;
          }
        }
        const lines = [
          t("app_context_header"),
          "",
          t("app_context_active_tokens", tokens.toLocaleString()),
          t("app_context_total_tokens", totalTokens.toLocaleString()),
          "",
          t("app_context_tip")
        ];
        setMessages((prev) => [...prev, buildSyntheticAssistantMessage(lines.join("\n"))]);
        return;
      }
      if (submission.command === "save-memory") {
        const note = submission.text ?? "";
        if (note.trim()) {
          const ok = sessionManager.appendAgentNote(note.trim());
          setMessages((prev) => [
            ...prev,
            buildSyntheticUserMessage(`# ${note}`, 0),
            buildSyntheticAssistantMessage(
              ok
                ? t("app_note_saved", note)
                : t("app_note_failed")
            )
          ]);
        }
        return;
      }
      if (submission.command === "init") {
        const agentsPath = path.join(projectRoot, "AGENTS.md");
        if (fs.existsSync(agentsPath)) {
          setMessages((prev) => [
            ...prev,
            buildSyntheticAssistantMessage(t("app_agents_exists", agentsPath))
          ]);
          return;
        }
        const initMsg = buildSyntheticAssistantMessage(t("app_agents_generating"));
        setMessages((prev) => [...prev, initMsg]);
        setBusy(true);
        setErrorLine(null);
        try {
          await sessionManager.generateAgentsMd(projectRoot);
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== initMsg.id),
            buildSyntheticAssistantMessage(t("app_agents_created", agentsPath))
          ]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== initMsg.id),
            buildSyntheticAssistantMessage(t("app_agents_failed", message))
          ]);
        } finally {
          setBusy(false);
        }
        return;
      }

      if (submission.command === "model") {
        const modelName = (submission.text ?? "").trim();
        if (!modelName) {
          const current = getSettingsService().getResolvedSettings().model;
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_model_current", current))]);
          return;
        }
        getSettingsService().updateSettings((s) => ({ ...s, env: { ...(s.env ?? {}), MODEL: modelName } }));
        setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_model_changed", modelName))]);
        return;
      }

      if (submission.command === "thinking") {
        const current = getSettingsService().getResolvedSettings();
        const next = !current.thinkingEnabled;
        getSettingsService().updateSettings((s) => ({ ...s, thinkingEnabled: next }));
        setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t(next ? "app_thinking_on" : "app_thinking_off"))]);
        return;
      }

      if (submission.command === "effort") {
        const effortVal = (submission.text ?? "").trim().toLowerCase();
        if (!effortVal) {
          const current = getSettingsService().getResolvedSettings().reasoningEffort;
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_effort_current", current))]);
          return;
        }
        if (effortVal !== "high" && effortVal !== "max") {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_effort_invalid"))]);
          return;
        }
        getSettingsService().updateSettings((s) => ({ ...s, reasoningEffort: effortVal as "high" | "max" }));
        setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_effort_changed", effortVal))]);
        return;
      }

      if (submission.command === "cwd") {
        const cwdPath = (submission.text ?? "").trim();
        if (!cwdPath) {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_cwd_current", projectRoot))]);
          return;
        }
        const resolved = path.resolve(cwdPath);
        if (!fs.existsSync(resolved)) {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_cwd_invalid", resolved))]);
          return;
        }
        // Update session-specific working directory instead of global process.chdir()
        const activeSessionId = sessionManager.getActiveSessionId();
        if (activeSessionId) {
          setSessionWorkingDirectory(activeSessionId, resolved);
        }
        setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_cwd_changed", resolved))]);
        return;
      }

      if (submission.command === "skill-new") {
        const skillName = (submission.text ?? "").trim();
        if (!skillName) {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_skill_usage"))]);
          return;
        }
        const skillDir = path.join(projectRoot, ".deepcode", "skills", skillName);
        const skillFile = path.join(skillDir, "SKILL.md");
        if (fs.existsSync(skillFile)) {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_skill_exists", skillFile))]);
          return;
        }
        try {
          fs.mkdirSync(skillDir, { recursive: true });
          const template = [
            `---`,
            `name: ${skillName}`,
            `description: Describe what this skill does`,
            `---`,
            ``,
            `## Overview`,
            ``,
            `This skill helps with...`,
            ``,
            `## Instructions`,
            ``,
            `When asked to use this skill, you should:`,
            ``,
            `1. Step one`,
            `2. Step two`,
          ].join("\n");
          fs.writeFileSync(skillFile, template, "utf8");
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_skill_created", skillFile))]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_skill_failed", message))]);
        }
        return;
      }

      if (submission.command === "mcp-add") {
        const mcpArgs = (submission.text ?? "").trim();
        if (!mcpArgs) {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_mcp_usage"))]);
          return;
        }
        const parts = mcpArgs.split(/\s+/);
        const serverName = parts[0];
        const command = parts[1];
        if (!serverName || !command) {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_mcp_usage"))]);
          return;
        }
        const args = parts.slice(2);
        const serverConfig: McpServerConfig = args.length > 0 ? { command, args } : { command };
        try {
          getSettingsService().updateSettings((s) => ({
            ...s,
            mcpServers: { ...(s.mcpServers ?? {}), [serverName]: serverConfig }
          }));
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_mcp_added", serverName))]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_mcp_failed", message))]);
        }
        return;
      }

      if (submission.command === "key") {
        const newKey = (submission.text ?? "").trim();
        if (!newKey) {
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_key_usage"))]);
          return;
        }
        try {
          getSettingsService().updateSettings((s) => ({
            ...s,
            env: { ...(s.env ?? {}), API_KEY: newKey }
          }));
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_key_updated"))]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setMessages((prev) => [...prev, buildSyntheticAssistantMessage(t("app_key_failed", message))]);
        }
        return;
      }

      if (submission.command === "settings") {
        const resolvedSettings = getSettingsService().getResolvedSettings();
        const activeSessionId = sessionManager.getActiveSessionId();
        const currentCwd = activeSessionId
          ? getSessionWorkingDirectory(activeSessionId, projectRoot)
          : projectRoot;
        const tools = getRecommendedCliToolsStatus();
        const toolsSummary = [
          `rg: ${tools.rg ? t("app_settings_tool_ready") : t("app_settings_tool_missing")}`,
          `jq: ${tools.jq ? t("app_settings_tool_ready") : t("app_settings_tool_missing")}`
        ].join(", ");
        const keyStatus = resolvedSettings.apiKey ? t("app_settings_key_set") : t("app_settings_key_unset");
        setMessages((prev) => [
          ...prev,
          buildSyntheticAssistantMessage(
            t(
              "app_settings_summary",
              keyStatus,
              resolvedSettings.model,
              resolvedSettings.baseURL,
              resolvedSettings.thinkingEnabled ? t("app_settings_enabled") : t("app_settings_disabled"),
              resolvedSettings.reasoningEffort,
              currentCwd,
              toolsSummary
            )
          )
        ]);
        return;
      }

      const goalText = submission.command === "goal" ? (submission.text ?? "").trim() : "";
      const promptText = goalText
        ? [
          `Goal: ${goalText}`,
          "",
          GOAL_MODE_INSTRUCTIONS
        ].join("\n")
        : submission.text;

      const prompt: UserPromptContent = {
        text: promptText,
        imageUrls: submission.imageUrls,
        skills: submission.selectedSkills && submission.selectedSkills.length > 0
          ? submission.selectedSkills
          : undefined
      };

      const trimmedText = (goalText || submission.text || "").trim();
      const selectedSkillNames = submission.selectedSkills?.map((skill) => skill.name).filter(Boolean) ?? [];
      const userDisplayContent = trimmedText
        || (selectedSkillNames.length > 0 ? `Use skills: ${selectedSkillNames.join(", ")}` : "")
        || (submission.imageUrls.length > 0 ? "[Image]" : "");

      if (userDisplayContent) {
        setMessages((prev) => [
          ...prev,
          buildSyntheticUserMessage(userDisplayContent, submission.imageUrls.length)
        ]);
      }

      setBusy(true);
      turnStartRef.current = Date.now();
      setErrorLine(null);
      setRunningProcesses(null);
      try {
        await sessionManager.handleUserPrompt(prompt);
        // Only show duration for completed turns, not interrupted ones
        const activeSessionId = sessionManager.getActiveSessionId();
        const finalSession = activeSessionId ? sessionManager.getSession(activeSessionId) : null;
        if (finalSession?.status !== "interrupted") {
          const elapsed = Date.now() - turnStartRef.current;
          const elapsedStr = elapsed >= 60000
            ? `${Math.floor(elapsed / 60000)}m ${Math.round((elapsed % 60000) / 1000)}s`
            : `${(elapsed / 1000).toFixed(1)}s`;
          setMessages((prev) => [
            ...prev,
            buildSyntheticAssistantMessage(`_Done in ${elapsedStr}_`)
          ]);
        }
        await refreshSkills();
        refreshSessionsList();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setErrorLine(message);
      } finally {
        setBusy(false);
        setStreamProgress(null);
        setRunningProcesses(null);
      }
    },
    [exit, onRestart, projectRoot, sessionManager, write]
  );

  const handleInterrupt = useCallback(() => {
    sessionManager.interruptActiveSession();
  }, [sessionManager]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      sessionManager.setActiveSessionId(sessionId);
      setMessages(loadVisibleMessages(sessionManager, sessionId));
      const session = sessionManager.getSession(sessionId);
      setStatusLine(session ? buildStatusLine(session) : "");
      setRunningProcesses(session?.processes ?? null);
      setActiveStatus(session?.status ?? null);
      setShowWelcome(false);
      setView("chat");
      await refreshSkills(sessionId);
    },
    [sessionManager]
  );

  const screenWidth = stdout?.columns ?? 80;
  const promptHistory = useMemo(() => {
    return messages
      .filter((message) => message.role === "user" && typeof message.content === "string")
      .map((message) => (message.content ?? "").trim())
      .filter((content) => content.length > 0);
  }, [messages]);
  const expandedThinkingId = findExpandedThinkingId(messages);
  const pendingQuestion = useMemo(
    () => findPendingAskUserQuestion(messages, activeStatus),
    [activeStatus, messages]
  );
  const shouldShowQuestionPrompt = Boolean(
    pendingQuestion && !dismissedQuestionIds.has(pendingQuestion.messageId)
  );
  const loadingText = busy
    ? buildLoadingText({ progress: streamProgress, processes: runningProcesses, now: Date.now() })
    : null;
  const welcomeSettings = useMemo(() => getSettingsService().getResolvedSettings(), []);
  const welcomeItem: SessionMessage = useMemo(() => ({
    id: "__welcome__",
    sessionId: "",
    role: "system",
    content: "",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: "",
    updateTime: ""
  }), []);
  const staticItems = useMemo(() => {
    if (showWelcome && view === "chat") {
      return [welcomeItem, ...messages];
    }
    return messages;
  }, [showWelcome, view, messages, welcomeItem]);

  const handleQuestionAnswers = useCallback(
    (answers: AskUserQuestionAnswers) => {
      void handlePrompt({
        text: formatAskUserQuestionAnswers(answers),
        imageUrls: []
      });
    },
    [handlePrompt]
  );

  const handleQuestionCancel = useCallback(() => {
    if (!pendingQuestion) {
      return;
    }
    setDismissedQuestionIds((prev) => new Set(prev).add(pendingQuestion.messageId));
  }, [pendingQuestion]);

  return (
    <Box flexDirection="column" width={screenWidth}>
      <Static items={staticItems}>
        {(item) => {
          if (item.id === "__welcome__") {
            return (
              <WelcomeScreen
                key="__welcome__"
                projectRoot={projectRoot}
                settings={welcomeSettings}
                skills={skills}
                version={version}
                width={screenWidth}
              />
            );
          }
          return (
            <MessageView
              key={item.id}
              message={item}
              collapsed={isCollapsedThinking(item, expandedThinkingId)}
            />
          );
        }}
      </Static>
      {statusLine ? (
        <Box>
          <Text dimColor>{statusLine}</Text>
        </Box>
      ) : null}
      {errorLine ? (
        <Box>
          <Text color="red">Error: {errorLine}</Text>
        </Box>
      ) : null}
      {view === "session-list" ? (
        <SessionList
          sessions={sessions}
          onSelect={(id) => void handleSelectSession(id)}
          onCancel={() => setView("chat")}
        />
      ) : shouldShowQuestionPrompt && pendingQuestion && !busy ? (
        <AskUserQuestionPrompt
          questions={pendingQuestion.questions}
          onSubmit={handleQuestionAnswers}
          onCancel={handleQuestionCancel}
        />
      ) : isExiting ? null : (
        <PromptInput
          skills={skills}
          promptHistory={promptHistory}
          busy={busy}
          loadingText={loadingText}
          onSubmit={(submission) => void handlePrompt(submission)}
          onInterrupt={handleInterrupt}
        />
      )}
    </Box>
  );
}

function isCollapsedThinking(message: SessionMessage, expandedId: string | null): boolean {
  if (message.role !== "assistant") {
    return false;
  }
  if (!message.meta?.asThinking) {
    return false;
  }
  return message.id !== expandedId;
}

function buildSyntheticUserMessage(content: string, imageCount: number): SessionMessage {
  const now = new Date().toISOString();
  return {
    id: `local-${Math.random().toString(36).slice(2)}`,
    sessionId: "local",
    role: "user",
    content,
    contentParams:
      imageCount > 0
        ? Array.from({ length: imageCount }, () => ({
            type: "image_url",
            image_url: { url: "" }
          }))
        : null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now
  };
}

function buildSyntheticAssistantMessage(content: string): SessionMessage {
  const now = new Date().toISOString();
  return {
    id: `local-${Math.random().toString(36).slice(2)}`,
    sessionId: "local",
    role: "assistant",
    content,
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now
  };
}

function buildStatusLine(entry: SessionEntry): string {
  const parts: string[] = [];
  parts.push(`status: ${entry.status}`);
  if (typeof entry.activeTokens === "number" && entry.activeTokens > 0) {
    parts.push(`tokens: ${entry.activeTokens}`);
  }
  if (entry.failReason) {
    parts.push(`fail: ${entry.failReason}`);
  }
  return parts.join(" · ");
}

export function createOpenAIClient(): {
  client: OpenAI | null;
  model: string;
  baseURL: string;
  thinkingEnabled: boolean;
  reasoningEffort: "high" | "max";
  debugLogEnabled: boolean;
  timeout?: number;
  maxRetries?: number;
  notify?: string;
  webSearchTool?: string;
  machineId?: string;
} {
  const settings = getSettingsService().getResolvedSettings();
  if (!settings.apiKey) {
    return {
      client: null,
      model: settings.model,
      baseURL: settings.baseURL,
      thinkingEnabled: settings.thinkingEnabled,
      reasoningEffort: settings.reasoningEffort,
      debugLogEnabled: settings.debugLogEnabled,
      timeout: settings.timeout,
      maxRetries: settings.maxRetries,
      notify: settings.notify,
      webSearchTool: settings.webSearchTool,
      machineId: getMachineId()
    };
  }

  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL || undefined,
    timeout: settings.timeout,
    maxRetries: settings.maxRetries
  });
  return {
    client,
    model: settings.model,
    baseURL: settings.baseURL,
    thinkingEnabled: settings.thinkingEnabled,
    reasoningEffort: settings.reasoningEffort,
    debugLogEnabled: settings.debugLogEnabled,
    timeout: settings.timeout,
    maxRetries: settings.maxRetries,
    notify: settings.notify,
    webSearchTool: settings.webSearchTool,
    machineId: getMachineId()
  };
}

function getMachineId(): string | undefined {
  try {
    const idPath = path.join(os.homedir(), ".deepcode", "machine-id");
    if (fs.existsSync(idPath)) {
      const raw = fs.readFileSync(idPath, "utf8").trim();
      if (raw) {
        return raw;
      }
    }
    const generated = `${os.hostname()}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    fs.mkdirSync(path.dirname(idPath), { recursive: true });
    fs.writeFileSync(idPath, generated, "utf8");
    return generated;
  } catch {
    return undefined;
  }
}
