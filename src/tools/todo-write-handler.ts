import { getTodoService, type Todo } from "../services/TodoService";
import type { ToolExecutionContext, ToolExecutionResult } from "./executor";

export async function handleTodoWriteTool(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const rawTodos = args.todos;
  if (!Array.isArray(rawTodos)) {
    return {
      ok: false,
      name: "TodoWrite",
      error: "\"todos\" must be an array of todo objects."
    };
  }

  const todos: Todo[] = [];
  for (let i = 0; i < rawTodos.length; i++) {
    const item = rawTodos[i] as Record<string, unknown> | null | undefined;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, name: "TodoWrite", error: `Item at index ${i} must be an object.` };
    }
    const id = typeof item.id === "string" ? item.id.trim() : `todo-${i}`;
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (!content) {
      return { ok: false, name: "TodoWrite", error: `Item at index ${i} must have a non-empty "content" string.` };
    }
    const status = item.status;
    if (status !== "pending" && status !== "in_progress" && status !== "completed") {
      return {
        ok: false,
        name: "TodoWrite",
        error: `Item at index ${i} has invalid status "${String(status)}". Use "pending", "in_progress", or "completed".`
      };
    }
    todos.push({ id, content, status });
  }

  const result = getTodoService().setTodos(context.projectRoot, context.sessionId, todos);
  if (!result.ok) {
    return { ok: false, name: "TodoWrite", error: result.error };
  }

  const summary = todos
    .map((t) => {
      const icon = t.status === "completed" ? "☑" : t.status === "in_progress" ? "▶" : "☐";
      return `${icon} ${t.content}`;
    })
    .join("\n");

  return {
    ok: true,
    name: "TodoWrite",
    output: `TODO list updated (${todos.length} items):\n${summary}`
  };
}
