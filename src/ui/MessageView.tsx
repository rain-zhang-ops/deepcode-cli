import React from "react";
import { Box, Text } from "ink";
import { renderMarkdown } from "./markdown";
import type { SessionMessage } from "../session";

type Props = {
  message: SessionMessage;
  collapsed?: boolean;
  expanded?: boolean;
};

export function MessageView({ message, expanded }: Props): React.ReactElement | null {
  if (!message.visible) {
    return null;
  }

  if (message.role === "user") {
    const text = message.content || "(no content)";
    return (
      <Box flexDirection="column" marginY={0}>
        <Text color="green">{`> ${text}`}</Text>
        {Array.isArray(message.contentParams) && message.contentParams.length > 0 ? (
          <Text color="green">{`  📎 ${message.contentParams.length} image attachment(s)`}</Text>
        ) : null}
      </Box>
    );
  }

  if (message.role === "assistant") {
    const isThinking = Boolean(message.meta?.asThinking);
    const content = (message.content || "").trim();

    if (isThinking) {
      const summary = buildThinkingSummary(content, message.messageParams);
      return (
        <Box marginY={0}>
          <StatusLine bulletColor="gray" name="Thinking" params={summary} />
        </Box>
      );
    }

    return (
      <Box flexDirection="column" marginY={0}>
        <Text color="cyan" bold>Assistant</Text>
        <Box marginLeft={2} flexDirection="column">
          {content ? <Text>{renderMarkdown(content)}</Text> : null}
        </Box>
      </Box>
    );
  }

  if (message.role === "tool") {
    const summary = buildToolSummary(message);
    const diffLines = getToolDiffPreviewLines(summary);
    const isExpanded = expanded === true;
    return (
      <Box flexDirection="column" marginY={0}>
        <StatusLine
          bulletColor={summary.ok ? "green" : "red"}
          name={formatStatusName(summary.name)}
          params={formatToolStatusParams(summary)}
          dimmed={!isExpanded}
        />
        {diffLines.length > 0 ? <DiffPreview lines={diffLines} /> : null}
        {isExpanded ? <ToolResultOutput content={message.content} /> : null}
      </Box>
    );
  }

  if (message.role === "system") {
    if (message.meta?.skill) {
      return (
        <Box marginY={0}>
          <Text color="magenta">⚡ Loaded skill: {message.meta.skill.name}</Text>
        </Box>
      );
    }
    if (message.meta?.isSummary) {
      return (
        <Box marginY={0}>
          <Text dimColor italic>(conversation summary inserted)</Text>
        </Box>
      );
    }
    return null;
  }

  return null;
}

function StatusLine({
  bulletColor,
  name,
  params,
  dimmed
}: {
  bulletColor: "gray" | "green" | "red";
  name: string;
  params: string;
  dimmed?: boolean;
}): React.ReactElement {
  return (
    <Text wrap="truncate-end">
      {[
        <Text key="bullet" color={dimmed ? "gray" : bulletColor}>{dimmed ? "·" : "•"}</Text>,
        " ",
        <Text key="name" bold dimColor={dimmed}>{name}</Text>,
        params ? <Text key="params" dimColor={dimmed}>{`  ${params}`}</Text> : null,
        dimmed ? <Text key="hint" dimColor>  (collapsed)</Text> : null
      ]}
    </Text>
  );
}

function formatToolStatusParams(summary: ToolSummary): string {
  const params = firstNonEmptyLine(summary.params);
  return summary.name.toLowerCase() === "bash" ? params : truncate(params, 120);
}

type ToolSummary = {
  name: string;
  params: string;
  ok: boolean;
  metadata: Record<string, unknown> | null;
};

type DiffPreviewLine = {
  marker: string;
  content: string;
  kind: "added" | "removed" | "context";
};

function buildToolSummary(message: SessionMessage): ToolSummary {
  const payload = parseToolPayload(message.content);
  const metaFunctionName =
    message.meta?.function && typeof (message.meta.function as { name?: unknown }).name === "string"
      ? (message.meta.function as { name: string }).name
      : null;
  const name = payload.name || metaFunctionName || "tool";
  const params = name === "AskUserQuestion"
    ? extractAskUserQuestionParams(message) || getMetaParams(message)
    : getMetaParams(message);

  return {
    name,
    params,
    ok: payload.ok !== false,
    metadata: payload.metadata
  };
}

function getMetaParams(message: SessionMessage): string {
  return typeof message.meta?.paramsMd === "string" ? message.meta.paramsMd.trim() : "";
}

function extractAskUserQuestionParams(message: SessionMessage): string {
  const fromFunction = extractQuestionsFromToolFunction(message.meta?.function);
  if (fromFunction) {
    return fromFunction;
  }

  const params = getMetaParams(message);
  if (!params) {
    return "";
  }

  try {
    const parsed = JSON.parse(params);
    return extractQuestionsFromValue(parsed);
  } catch {
    return "";
  }
}

function extractQuestionsFromToolFunction(toolFunction: unknown): string {
  if (!toolFunction || typeof toolFunction !== "object") {
    return "";
  }
  const args = (toolFunction as { arguments?: unknown }).arguments;
  if (typeof args !== "string" || !args.trim()) {
    return "";
  }
  try {
    const parsed = JSON.parse(args);
    return extractQuestionsFromValue((parsed as { questions?: unknown })?.questions);
  } catch {
    return "";
  }
}

function extractQuestionsFromValue(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return "";
      }
      return typeof (item as { question?: unknown }).question === "string"
        ? (item as { question: string }).question.trim()
        : "";
    })
    .filter(Boolean)
    .join(" / ");
}

function parseToolPayload(
  content: string | null
): { name: string | null; ok: boolean; metadata: Record<string, unknown> | null } {
  if (!content) {
    return { name: null, ok: true, metadata: null };
  }

  try {
    const parsed = JSON.parse(content) as { name?: unknown; ok?: unknown; metadata?: unknown };
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : null,
      ok: parsed.ok !== false,
      metadata: isPlainRecord(parsed.metadata) ? parsed.metadata : null
    };
  } catch {
    return { name: null, ok: true, metadata: null };
  }
}

function getToolDiffPreviewLines(summary: ToolSummary): DiffPreviewLine[] {
  if (!summary.ok || !["edit", "write"].includes(summary.name.toLowerCase())) {
    return [];
  }
  const diffPreview = summary.metadata?.diff_preview;
  if (typeof diffPreview !== "string" || !diffPreview.trim()) {
    return [];
  }
  return parseDiffPreview(diffPreview);
}

export function parseDiffPreview(diffPreview: string): DiffPreviewLine[] {
  return diffPreview
    .split("\n")
    .filter((line) => line && !line.startsWith("--- ") && !line.startsWith("+++ ") && !line.startsWith("@@ "))
    .map((line) => {
      if (line.startsWith("+")) {
        return { marker: "+", content: line.slice(1), kind: "added" };
      }
      if (line.startsWith("-")) {
        return { marker: "-", content: line.slice(1), kind: "removed" };
      }
      return {
        marker: " ",
        content: line.startsWith(" ") ? line.slice(1) : line,
        kind: "context"
      };
    });
}

function DiffPreview({ lines }: { lines: DiffPreviewLine[] }): React.ReactElement {
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text dimColor>└ Changes</Text>
      <Box flexDirection="column" marginLeft={2}>
        {lines.map((line, index) => (
          <Text key={`${index}-${line.marker}-${line.content}`} wrap="truncate-end">
            <Text color={line.kind === "added" ? "green" : line.kind === "removed" ? "red" : "gray"}>
              {line.marker}
            </Text>
            <Text color={line.kind === "added" ? "green" : line.kind === "removed" ? "red" : undefined}>
              {line.content}
            </Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatStatusName(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "Tool";
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

function firstNonEmptyLine(value: string): string {
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/\s+/g, " ");
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function ToolResultOutput({ content }: { content: string | null }): React.ReactElement | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as {
      output?: string;
      error?: string;
      name?: string;
    };

    const output = typeof parsed.output === "string" ? parsed.output.trim() : "";
    const error = typeof parsed.error === "string" ? parsed.error.trim() : "";

    if (!output && !error) {
      return null;
    }

    const maxLines = 20;
    const outputLines = output ? output.split("\n") : [];
    const errorLines = error ? error.split("\n") : [];
    const totalLines = outputLines.length + errorLines.length;
    const truncated = totalLines > maxLines;

    const displayLines = [
      ...outputLines,
      ...(output && error ? [""] : []),
      ...errorLines,
    ].slice(0, maxLines);

    return (
      <Box flexDirection="column" marginLeft={2}>
        <Text dimColor>└ output{truncated ? ` (showing ${maxLines} of ${totalLines} lines)` : ""}:</Text>
        <Box flexDirection="column" marginLeft={2}>
          {displayLines.map((line, idx) => {
            const isError = error && idx >= outputLines.length + (output ? 1 : 0);
            return (
              <Text
                key={idx}
                color={isError ? "red" : undefined}
                dimColor={!isError}
                wrap="truncate-end"
              >
                {line || " "}
              </Text>
            );
          })}
          {truncated ? (
            <Text dimColor>… truncated {totalLines - maxLines} more lines</Text>
          ) : null}
        </Box>
      </Box>
    );
  } catch {
    // Not valid JSON — show raw content (truncated)
    const raw = content.trim();
    if (!raw) return null;
    const lines = raw.split("\n").slice(0, 10);
    return (
      <Box flexDirection="column" marginLeft={2}>
        <Text dimColor>└ output:</Text>
        <Box flexDirection="column" marginLeft={2}>
          {lines.map((line, idx) => (
            <Text key={idx} dimColor wrap="truncate-end">{line || " "}</Text>
          ))}
          {raw.split("\n").length > 10 ? (
            <Text dimColor>… truncated</Text>
          ) : null}
        </Box>
      </Box>
    );
  }
}

function buildThinkingSummary(content: string, messageParams: unknown | null): string {
  if (content) {
    const normalized = content.replace(/\r?\n/g, " ").replace(/\s+/g, " ");
    let result = truncate(normalized, 100);
    if (result.endsWith(":") || result.endsWith("：")) {
      result = result.slice(0, -1);
    }
    return result;
  }

  const params = messageParams as { reasoning_content?: unknown } | null | undefined;
  if (typeof params?.reasoning_content === "string" && params.reasoning_content.trim()) {
    return "(reasoning...)";
  }

  return "";
}
