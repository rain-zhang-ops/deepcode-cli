import { getTodoService } from "../services/TodoService";
import type { ToolExecutionContext, ToolExecutionResult } from "./executor";

export async function handleTodoReadTool(
  _args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const todos = getTodoService().getTodos(context.projectRoot, context.sessionId);

  if (todos.length === 0) {
    return {
      ok: true,
      name: "TodoRead",
      output: "No todos found for this session."
    };
  }

  const summary = todos
    .map((t) => {
      const icon = t.status === "completed" ? "☑" : t.status === "in_progress" ? "▶" : "☐";
      return `${icon} [${t.id}] ${t.content} (${t.status})`;
    })
    .join("\n");

  return {
    ok: true,
    name: "TodoRead",
    output: summary
  };
}
