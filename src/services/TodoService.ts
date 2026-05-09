import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type TodoStatus = "pending" | "in_progress" | "completed";

export type Todo = {
  id: string;
  content: string;
  status: TodoStatus;
};

export type TodoList = {
  sessionId: string;
  todos: Todo[];
};

type TodoUpdateListener = (todos: Todo[]) => void;

export class TodoService {
  private static instance: TodoService;
  private listeners = new Map<string, Set<TodoUpdateListener>>();

  private constructor() {}

  static getInstance(): TodoService {
    if (!TodoService.instance) {
      TodoService.instance = new TodoService();
    }
    return TodoService.instance;
  }

  /**
   * Return the path to the todos JSON file for a session.
   * Stored alongside session data in ~/.deepcode/projects/<projectCode>/<sessionId>/todos.json
   */
  private getTodosPath(projectDir: string, sessionId: string): string {
    return path.join(projectDir, sessionId, "todos.json");
  }

  private getProjectDir(projectRoot: string): string {
    const projectCode = projectRoot.replace(/[\\/]/g, "-").replace(/:/g, "");
    return path.join(os.homedir(), ".deepcode", "projects", projectCode);
  }

  /**
   * Read the current todo list for a session. Returns [] if not found.
   */
  getTodos(projectRoot: string, sessionId: string): Todo[] {
    const todosPath = this.getTodosPath(this.getProjectDir(projectRoot), sessionId);
    if (!fs.existsSync(todosPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(todosPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isTodo);
    } catch {
      return [];
    }
  }

  /**
   * Overwrite the todo list for a session.
   * Validates that at most one todo has status "in_progress".
   */
  setTodos(projectRoot: string, sessionId: string, todos: Todo[]): { ok: true } | { ok: false; error: string } {
    const inProgressCount = todos.filter((t) => t.status === "in_progress").length;
    if (inProgressCount > 1) {
      return { ok: false, error: "At most one todo may have status \"in_progress\" at a time." };
    }

    const projectDir = this.getProjectDir(projectRoot);
    const sessionDir = path.join(projectDir, sessionId);
    try {
      fs.mkdirSync(sessionDir, { recursive: true });
      fs.writeFileSync(path.join(sessionDir, "todos.json"), JSON.stringify(todos, null, 2), "utf8");
    } catch (error) {
      return { ok: false, error: `Failed to write todos: ${error instanceof Error ? error.message : String(error)}` };
    }

    this.emit(sessionId, todos);
    return { ok: true };
  }

  /**
   * Subscribe to todo updates for a session.
   */
  subscribe(sessionId: string, listener: TodoUpdateListener): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)!.add(listener);
    return () => {
      this.listeners.get(sessionId)?.delete(listener);
    };
  }

  private emit(sessionId: string, todos: Todo[]): void {
    this.listeners.get(sessionId)?.forEach((fn) => fn(todos));
  }
}

function isTodo(value: unknown): value is Todo {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.content === "string" &&
    (v.status === "pending" || v.status === "in_progress" || v.status === "completed")
  );
}

export function getTodoService(): TodoService {
  return TodoService.getInstance();
}
