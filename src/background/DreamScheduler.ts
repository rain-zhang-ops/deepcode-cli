import { BackgroundTaskManager, type BackgroundTask } from "./BackgroundTaskManager";

// ── Types ───────────────────────────────────────────────────────────────────

export type DreamKind =
  | "context-analyze"     // analyze conversation context for insights
  | "code-review"         // review recent code changes
  | "memory-consolidate"  // consolidate conversation memory
  | "self-reflect"        // model self-reflection on performance
  | "custom";             // user-defined dream

export type DreamTask = {
  kind: DreamKind;
  label: string;
  prompt: string;
  /** Optional cooldown in ms after this dream type completes (default 60s). */
  cooldownMs?: number;
};

export type DreamHandler = (
  dream: DreamTask,
  signal: AbortSignal
) => Promise<void>;

export type DreamSchedulerEvents = {
  "dream:scheduled": [dream: DreamTask];
  "dream:started": [dream: DreamTask, task: BackgroundTask];
  "dream:completed": [dream: DreamTask, task: BackgroundTask];
  "dream:failed": [dream: DreamTask, task: BackgroundTask, error: Error];
};

export type DreamSchedulerOptions = {
  /** Only schedule dreams when the manager has been idle for this many ms (default 5000). */
  idleThresholdMs?: number;
  /** Minimum time between any two dreams (default 30000). */
  globalCooldownMs?: number;
  /** Default cooldown per dream kind when not specified in the DreamTask (default 60000). */
  defaultCooldownMs?: number;
};

// ── Scheduler ───────────────────────────────────────────────────────────────

export class DreamScheduler {
  private readonly taskManager: BackgroundTaskManager;
  private readonly handler: DreamHandler;
  private readonly options: Required<DreamSchedulerOptions>;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastDreamAt: number = 0;
  private lastDreamKindAt = new Map<DreamKind, number>();
  private idleSince: number = 0;
  private destroyed = false;

  /** Pending dreams waiting for idle time. */
  private pendingDreams: DreamTask[] = [];

  // Stored listener references for cleanup
  private readonly onManagerIdle: () => void;
  private readonly onManagerActive: () => void;
  private readonly onTaskFinished: () => void;

  constructor(
    taskManager: BackgroundTaskManager,
    handler: DreamHandler,
    options: DreamSchedulerOptions = {}
  ) {
    this.taskManager = taskManager;
    this.handler = handler;
    this.options = {
      idleThresholdMs: options.idleThresholdMs ?? 5000,
      globalCooldownMs: options.globalCooldownMs ?? 30000,
      defaultCooldownMs: options.defaultCooldownMs ?? 60000,
    };

    this.onManagerIdle = () => {
      this.idleSince = Date.now();
      this.scheduleIdleCheck();
    };
    this.onManagerActive = () => {
      this.idleSince = 0;
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
    };
    this.onTaskFinished = () => {
      this.flushPendingDreams();
    };

    this.taskManager.on("manager:idle", this.onManagerIdle);
    this.taskManager.on("manager:active", this.onManagerActive);
    this.taskManager.on("task:completed", this.onTaskFinished);
    this.taskManager.on("task:failed", this.onTaskFinished);
  }

  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Schedule a dream for the next idle window. If the manager is already idle
   * long enough, it executes immediately.
   */
  schedule(dream: DreamTask): void {
    if (this.destroyed) return;

    // Check cooldowns — if still cooling down, queue for later
    if (!this.canDreamNow(dream)) {
      this.pendingDreams.push(dream);
      return;
    }

    this.enqueueDream(dream);
  }

  /**
   * Force a dream to run immediately, bypassing idle checks and cooldowns.
   */
  force(dream: DreamTask): Promise<void> {
    if (this.destroyed) return Promise.resolve();

    return this.taskManager.enqueue(
      `dream:${dream.kind}`,
      (signal) => this.handler(dream, signal),
      {
        priority: "low",
        description: dream.label,
        meta: { dreamKind: dream.kind },
      }
    );
  }

  /** Cancel all pending dreams. Running dreams are not interrupted. */
  clearPending(): void {
    this.pendingDreams = [];
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.clearPending();
    this.taskManager.off("manager:idle", this.onManagerIdle);
    this.taskManager.off("manager:active", this.onManagerActive);
    this.taskManager.off("task:completed", this.onTaskFinished);
    this.taskManager.off("task:failed", this.onTaskFinished);
  }

  // ── internal ─────────────────────────────────────────────────────────────

  private scheduleIdleCheck(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.destroyed) return;

    const remaining = this.options.idleThresholdMs - (Date.now() - this.idleSince);
    const delay = Math.max(0, remaining);

    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.flushPendingDreams();
    }, delay);
  }

  private canDreamNow(dream: DreamTask): boolean {
    const now = Date.now();

    // Global cooldown
    if (now - this.lastDreamAt < this.options.globalCooldownMs) {
      return false;
    }

    // Per-kind cooldown
    const kindCooldown = dream.cooldownMs ?? this.options.defaultCooldownMs;
    const lastKindAt = this.lastDreamKindAt.get(dream.kind) ?? 0;
    if (now - lastKindAt < kindCooldown) {
      return false;
    }

    return true;
  }

  private enqueueDream(dream: DreamTask): void {
    const now = Date.now();
    this.lastDreamAt = now;
    this.lastDreamKindAt.set(dream.kind, now);

    this.taskManager
      .enqueue(
        `dream:${dream.kind}`,
        (signal) => this.handler(dream, signal),
        {
          priority: "idle",
          description: dream.label,
          meta: { dreamKind: dream.kind },
        }
      )
      .catch(() => {
        // Dream failures are non-fatal; handler errors are logged internally
      });
  }

  private flushPendingDreams(): void {
    if (this.pendingDreams.length === 0) return;

    const dreams = [...this.pendingDreams];
    this.pendingDreams = [];

    for (const dream of dreams) {
      if (this.canDreamNow(dream)) {
        this.enqueueDream(dream);
      } else {
        // Not ready yet — put it back and wait for the next idle window
        this.pendingDreams.push(dream);
      }
    }
  }
}
