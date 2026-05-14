import type { SessionMessage } from "../session";

/**
 * Returns the message id of the assistant "thinking" message that should stay
 * expanded — i.e. the most recent thinking message after the most recent
 * non-thinking assistant message. Mirrors the VS Code extension's bubble
 * collapse logic: at most one thinking bubble is open, and it is closed once a
 * regular assistant reply arrives.
 */
export function findExpandedThinkingId(messages: SessionMessage[]): string | null {
  let expanded: string | null = null;
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    if (message.meta?.asThinking) {
      expanded = message.id;
    } else {
      expanded = null;
    }
  }
  return expanded;
}

/**
 * Returns the message id of the most recent tool message that should show its
 * full output inline. Only the single most recent tool result stays expanded;
 * all earlier ones collapse to a one-line summary.
 */
export function findExpandedToolId(messages: SessionMessage[]): string | null {
  // Walk backwards — the first tool we hit is the most recent chronologically
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "tool") {
      return messages[i].id;
    }
  }
  return null;
}
