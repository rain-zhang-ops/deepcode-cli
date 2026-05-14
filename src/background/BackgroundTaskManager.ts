import { EventEmitter } from "node:events";
import * as crypto from "crypto";

// ── Types ───────────────────────────────────────────────────────────────────

export type BackgroundTaskPriority = "high" | "normal" | "low" | "idle";

export type BackgroundTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type BackgroundTask = {
  id: string;
  name: string;
  description?: string;
  priority: BackgroundTaskPriority;
  status: BackgroundTaskStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  timeoutMs?: number;
  error?: string;
  /** Arbitrary metadata for subscribers to inspect. */
  meta?: Record<string, unknown>;
};

type EnqueuedTask = BackgroundTask & {
  handler: (signal: AbortSignal) => Promise<void>;
  controller: AbortController;
  resolve: () => void;
  reject: (error: Error) => void;
};

export type BackgroundTaskManagerEvents = {
  "task:enqueued": [task: BackgroundTask];
  "task:started": [task: BackgroundTask];
  "task:completed": [task: BackgroundTask];
  "task:failed": [task: BackgroundTask, error: Error];
  "task:cancelled": [task: BackgroundTask];
  /** Fires when the queue transitions from busy → idle (no running + no pending). */
  "manager:idle": [];
  /** Fires when the first task starts after an idle period. */
  "manager:active": [];
};

export type BackgroundTaskManagerOptions = {
  /** Maximum number of tasks that may run concurrently (default 1). */
  maxConcurrency?: number;
};

const PRIORITY_ORDER: Record<BackgroundTaskPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
  idle: 3,
};

// ── Manager ─────────────────────────────────────────────────────────────────

export class BackgroundTaskManager extends EventEmitter<BackgroundTaskManagerEvents> {
  private readonly queue: EnqueuedTask[] = [];
  private readonly running = new Map<string, EnqueuedTask>();
  private readonly maxConcurrency: number;
  private destroyed = false;
  private idleEmitted = false;

  constructor(options: BackgroundTaskManagerOptions = {}) {
    super();
    this.maxConcurrency = Math.max(1, options.maxConcurrency ?? 1);
  }

  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Enqueue a background task. Returns a Promise that resolves when the task
   * completes, or rejects when it fails / is cancelled.
   */
  enqueue(
    name: string,
    handler: (signal: AbortSignal) => Promise<void>,
    options?: {
      priority?: BackgroundTaskPriority;
      description?: string;
      timeoutMs?: number;
      meta?: Record<string, unknown>;
    }
  ): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error("BackgroundTaskManager is destroyed"));
    }

    const id = crypto.randomUUID();
    const controller = new AbortController();

    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const task: EnqueuedTask = {
      id,
      name,
      description: options?.description,
      priority: options?.priority ?? "normal",
      status: "pending",
      createdAt: new Date().toISOString(),
      timeoutMs: options?.timeoutMs,
      meta: options?.meta,
      handler,
      controller,
      resolve,
      reject,
    };

    this.queue.push(task);
    this.sortQueue();
    this.emit("task:enqueued", task);
    this.flush();

    return promise;
  }

  /**
   * Cancel a pending or running task by id. Resolves the enqueue promise with a
   * cancellation error.
   */
  cancel(taskId: string): boolean {
    // Check pending queue
    const pendingIdx = this.queue.findIndex((t) => t.id === taskId);
    if (pendingIdx !== -1) {
      const [task] = this.queue.splice(pendingIdx, 1);
      task.status = "cancelled";
      task.finishedAt = new Date().toISOString();
      task.error = "Cancelled";
      task.controller.abort();
      task.reject(new Error("Cancelled"));
      this.emit("task:cancelled", task);
      return true;
    }

    // Check running
    const running = this.running.get(taskId);
    if (running) {
      running.status = "cancelled";
      running.finishedAt = new Date().toISOString();
      running.error = "Cancelled";
      running.controller.abort();
      this.running.delete(taskId);
      running.reject(new Error("Cancelled"));
      this.emit("task:cancelled", running);
      this.flush();
      return true;
    }

    return false;
  }

  /** Cancel all pending and running tasks. */
  cancelAll(): void {
    for (const task of [...this.queue]) {
      this.cancel(task.id);
    }
    for (const task of [...this.running.values()]) {
      this.cancel(task.id);
    }
  }

  /** Whether any tasks are running or pending (of non-idle priority). */
  get isBusy(): boolean {
    return (
      this.running.size > 0 ||
      this.queue.some((t) => t.priority !== "idle")
    );
  }

  /** Whether the manager has been destroyed. */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Number of pending tasks. */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Number of currently running tasks. */
  get runningCount(): number {
    return this.running.size;
  }

  /** Snapshot of all tasks (pending + running) for inspection. */
  snapshot(): BackgroundTask[] {
    const pending: BackgroundTask[] = this.queue.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt,
      meta: t.meta,
    }));
    const running: BackgroundTask[] = [];
    for (const t of this.running.values()) {
      running.push({
        id: t.id,
        name: t.name,
        description: t.description,
        priority: t.priority,
        status: t.status,
        createdAt: t.createdAt,
        startedAt: t.startedAt,
        meta: t.meta,
      });
    }
    return [...pending, ...running];
  }

  /**
   * Shut down the manager. Cancels all tasks, removes all listeners. After
   * calling destroy(), no more tasks can be enqueued.
   */
  destroy(): void {
    this.destroyed = true;
    this.cancelAll();
    this.removeAllListeners();
  }

  // ── internals ────────────────────────────────────────────────────────────

  private sortQueue(): void {
    this.queue.sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.createdAt.localeCompare(b.createdAt)
    );
  }

  private flush(): void {
    if (this.destroyed) return;

    const wasIdle = this.running.size === 0;

    while (
      this.running.size < this.maxConcurrency &&
      this.queue.length > 0
    ) {
      const task = this.queue.shift()!;
      this.running.set(task.id, task);
      this.runTask(task);
    }

    if (wasIdle && this.running.size > 0) {
      this.idleEmitted = false;
      this.emit("manager:active");
    } else if (!this.idleEmitted && this.running.size === 0 && this.queue.length === 0) {
      this.idleEmitted = true;
      this.emit("manager:idle");
    }
  }

  private runTask(task: EnqueuedTask): void {
    task.status = "running";
    task.startedAt = new Date().toISOString();
    this.emit("task:started", task);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      this.running.delete(task.id);
    };

    const onComplete = (): void => {
      task.status = "completed";
      task.finishedAt = new Date().toISOString();
      this.emit("task:completed", task);
      cleanup();
      task.resolve();
      this.flush();
    };

    const onFail = (error: Error): void => {
      if (task.status === "cancelled") return; // already handled by cancel()
      task.status = "failed";
      task.finishedAt = new Date().toISOString();
      task.error = error.message;
      this.emit("task:failed", task, error);
      cleanup();
      task.reject(error);
      this.flush();
    };

    // Optional timeout
    if (task.timeoutMs && task.timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        task.controller.abort();
        onFail(new Error(`Task "${task.name}" timed out after ${task.timeoutMs}ms`));
      }, task.timeoutMs);
    }

    // Execute the handler
    task
      .handler(task.controller.signal)
      .then(() => {
        if (task.controller.signal.aborted) return;
        onComplete();
      })
      .catch((error: unknown) => {
        if (task.controller.signal.aborted) return;
        onFail(error instanceof Error ? error : new Error(String(error)));
      });
  }
}
