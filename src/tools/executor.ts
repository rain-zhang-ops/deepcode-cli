import type OpenAI from "openai";
import type { ReasoningEffort } from "../settings";
import { getPermissionService } from "../services/PermissionService";
import { handleAskUserQuestionTool } from "./ask-user-question-handler";
import { handleBashTool } from "./bash-handler";
import { handleEditTool } from "./edit-handler";
import { handleReadTool } from "./read-handler";
import { handleTodoReadTool } from "./todo-read-handler";
import { handleTodoWriteTool } from "./todo-write-handler";
import { handleWebSearchTool } from "./web-search-handler";
import { handleWriteTool } from "./write-handler";

/** Tools that are safe to execute in parallel (read-only, no side effects). */
export const READ_ONLY_TOOLS = new Set(["read", "WebSearch", "TodoRead"]);

/** Maximum number of read-only tools to run concurrently in one batch. */
const MAX_PARALLEL_READS = 5;

export type CreateOpenAIClient = () => {
  client: OpenAI | null;
  model: string;
  baseURL?: string;
  thinkingEnabled: boolean;
  reasoningEffort?: ReasoningEffort;
  debugLogEnabled?: boolean;
  timeout?: number;
  maxRetries?: number;
  notify?: string;
  webSearchTool?: string;
  machineId?: string;
  qwenClient: OpenAI | null;
  qwenModel: string;
  qwenBaseURL?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolExecutionContext = {
  sessionId: string;
  projectRoot: string;
  toolCall: ToolCall;
  createOpenAIClient?: CreateOpenAIClient;
  onProcessStart?: (processId: string | number, command: string) => void;
  onProcessExit?: (processId: string | number) => void;
};

export type ToolExecutionHooks = {
  onProcessStart?: (processId: string | number, command: string) => void;
  onProcessExit?: (processId: string | number) => void;
  shouldStop?: () => boolean;
};

export type ToolExecutionResult = {
  ok: boolean;
  name: string;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  awaitUserResponse?: boolean;
  followUpMessages?: ToolExecutionFollowUpMessage[];
};

export type ToolExecutionFollowUpMessage = {
  role: "system";
  content: string;
  contentParams?: unknown | null;
};

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

export type ToolCallExecution = {
  toolCallId: string;
  content: string;
  result: ToolExecutionResult;
};

export class ToolExecutor {
  private readonly projectRoot: string;
  private readonly createOpenAIClient?: CreateOpenAIClient;
  private readonly toolHandlers = new Map<string, ToolHandler>();

  constructor(projectRoot: string, createOpenAIClient?: CreateOpenAIClient) {
    this.projectRoot = projectRoot;
    this.createOpenAIClient = createOpenAIClient;
    this.registerToolHandlers();
  }

  async executeToolCalls(
    sessionId: string,
    toolCalls: unknown[],
    hooks?: ToolExecutionHooks
  ): Promise<ToolCallExecution[]> {
    const parsedCalls = toolCalls
      .map((toolCall) => this.parseToolCall(toolCall))
      .filter((toolCall): toolCall is ToolCall => Boolean(toolCall));

    // Split into batches: consecutive read-only tools run in parallel; write tools are serial.
    // We process batches left-to-right, preserving original ordering in the output.
    const resultMap = new Map<string, ToolCallExecution>();

    let i = 0;
    while (i < parsedCalls.length) {
      if (hooks?.shouldStop?.()) break;

      const toolName = parsedCalls[i].function.name;
      if (READ_ONLY_TOOLS.has(toolName)) {
        // Collect a batch of consecutive read-only tools (up to MAX_PARALLEL_READS).
        const batch: ToolCall[] = [];
        while (
          i < parsedCalls.length &&
          READ_ONLY_TOOLS.has(parsedCalls[i].function.name) &&
          batch.length < MAX_PARALLEL_READS
        ) {
          batch.push(parsedCalls[i]);
          i++;
        }

        // Execute batch in parallel, then check shouldStop.
        const batchResults = await Promise.all(
          batch.map(async (toolCall) => {
            const result = await this.executeToolCall(sessionId, toolCall, hooks);
            return {
              toolCallId: toolCall.id,
              content: this.formatToolResult(result),
              result
            };
          })
        );

        if (hooks?.shouldStop?.()) break;
        for (const exec of batchResults) {
          resultMap.set(exec.toolCallId, exec);
        }
      } else {
        // Serial write tool.
        const toolCall = parsedCalls[i];
        i++;
        const result = await this.executeToolCall(sessionId, toolCall, hooks);
        resultMap.set(toolCall.id, {
          toolCallId: toolCall.id,
          content: this.formatToolResult(result),
          result
        });
        if (hooks?.shouldStop?.()) break;
      }
    }

    // Return results in original order (important for OpenAI tool_call_id pairing).
    return parsedCalls
      .map((tc) => resultMap.get(tc.id))
      .filter((exec): exec is ToolCallExecution => exec !== undefined);
  }

  private registerToolHandlers(): void {
    this.toolHandlers.set("bash", handleBashTool);
    this.toolHandlers.set("read", handleReadTool);
    this.toolHandlers.set("write", handleWriteTool);
    this.toolHandlers.set("edit", handleEditTool);
    this.toolHandlers.set("AskUserQuestion", handleAskUserQuestionTool);
    this.toolHandlers.set("WebSearch", handleWebSearchTool);
    this.toolHandlers.set("TodoWrite", handleTodoWriteTool);
    this.toolHandlers.set("TodoRead", handleTodoReadTool);
  }

  private parseToolCall(toolCall: unknown): ToolCall | null {
    if (!toolCall || typeof toolCall !== "object") {
      return null;
    }

    const record = toolCall as {
      id?: unknown;
      type?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };

    if (typeof record.id !== "string") {
      return null;
    }

    const functionRecord = record.function;
    if (!functionRecord || typeof functionRecord !== "object") {
      return null;
    }

    if (typeof functionRecord.name !== "string") {
      return null;
    }

    const rawArguments =
      typeof functionRecord.arguments === "string" ? functionRecord.arguments : "";

    return {
      id: record.id,
      type: "function",
      function: {
        name: functionRecord.name,
        arguments: rawArguments
      }
    };
  }

  private async executeToolCall(
    sessionId: string,
    toolCall: ToolCall,
    hooks?: ToolExecutionHooks
  ): Promise<ToolExecutionResult> {
    const toolName = toolCall.function.name;
    const handler = this.toolHandlers.get(toolName);
    if (!handler) {
      return {
        ok: false,
        name: toolName,
        error: `Unknown tool: ${toolName}`
      };
    }

    try {
      const parsedArgs = this.parseToolArguments(toolCall.function.arguments);
      if (!parsedArgs.ok) {
        return {
          ok: false,
          name: toolName,
          error: parsedArgs.error
        };
      }

      const permission = getPermissionService().check(toolName, parsedArgs.args);
      if (!permission.allowed) {
        return {
          ok: false,
          name: toolName,
          error: permission.reason
        };
      }

      return await handler(parsedArgs.args, {
        sessionId,
        projectRoot: this.projectRoot,
        toolCall,
        createOpenAIClient: this.createOpenAIClient,
        onProcessStart: hooks?.onProcessStart,
        onProcessExit: hooks?.onProcessExit
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        name: toolName,
        error: message
      };
    }
  }

  private parseToolArguments(
    rawArguments: string
  ): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
    if (!rawArguments) {
      return { ok: true, args: {} };
    }

    try {
      const parsed = JSON.parse(rawArguments);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "InputParseError: Tool arguments must be a JSON object." };
      }
      return { ok: true, args: parsed as Record<string, unknown> };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error:
          `InputParseError: Failed to parse tool arguments: ${message}. ` +
          "Ensure the tool call arguments are valid JSON. Prefer Edit over Write for large existing-file changes."
      };
    }
  }

  private formatToolResult(result: ToolExecutionResult): string {
    const payload: Record<string, unknown> = {
      ok: result.ok,
      name: result.name
    };

    if (typeof result.output !== "undefined") {
      payload.output = result.output;
    }

    if (result.error) {
      payload.error = result.error;
    }

    if (result.metadata && Object.keys(result.metadata).length > 0) {
      payload.metadata = result.metadata;
    }

    if (result.awaitUserResponse === true) {
      payload.awaitUserResponse = true;
    }

    return JSON.stringify(payload, null, 2);
  }

}
