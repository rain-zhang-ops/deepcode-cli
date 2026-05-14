import { BackgroundTaskManager } from "./BackgroundTaskManager";

// ── Types ───────────────────────────────────────────────────────────────────

export type RoutineHandler = (signal: AbortSignal) => Promise<void>;

export type Routine = {
  /** Unique name for the routine (used for logging and dedup). */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** Interval in ms between executions. */
  intervalMs: number;
  /** The async work to perform. */
  handler: RoutineHandler;
  /** Whether the routine should run immediately on registration (default false). */
  runImmediately?: boolean;
  /** Task priority within BackgroundTaskManager (default "low"). */
  priority?: "normal" | "low" | "idle";
};

export type RoutineManagerEvents = {
  "routine:registered": [routine: Routine];
  "routine:executed": [routine: Routine];
  "routine:failed": [routine: Routine, error: Error];
  "routine:removed": [name: string];
};

// ── Manager ─────────────────────────────────────────────────────────────────

export class RoutineManager {
  private readonly taskManager: BackgroundTaskManager;
  private readonly routines = new Map<string, Routine>();
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  private destroyed = false;

  constructor(taskManager: BackgroundTaskManager) {
    this.taskManager = taskManager;
  }

  // ── public API ──────────────────────────────────────────────────────────

  /** Register a recurring routine. If a routine with the same name exists, it is replaced. */
  register(routine: Routine): void {
    if (this.destroyed) return;

    // Replace existing routine with the same name
    if (this.routines.has(routine.name)) {
      this.remove(routine.name);
    }

    this.routines.set(routine.name, routine);

    const execute = (): void => {
      if (this.destroyed || !this.routines.has(routine.name)) return;
      this.taskManager.enqueue(
        `routine:${routine.name}`,
        (signal) => routine.handler(signal),
        {
          priority: routine.priority ?? "low",
          description: routine.description,
          meta: { routineName: routine.name },
        }
      ).catch((error) => {
        // Routine failures are non-fatal
      });
    };

    if (routine.runImmediately) {
      execute();
    }

    const timer = setInterval(execute, routine.intervalMs);
    // Allow the process to exit even if this timer is still active
    timer.unref();
    this.timers.set(routine.name, timer);
  }

  /** Remove a registered routine by name. */
  remove(name: string): boolean {
    const routine = this.routines.get(name);
    if (!routine) return false;

    this.routines.delete(name);

    const timer = this.timers.get(name);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(name);
    }

    return true;
  }

  /** Check if a routine with the given name is registered. */
  has(name: string): boolean {
    return this.routines.has(name);
  }

  /** Get all registered routines. */
  list(): Routine[] {
    return Array.from(this.routines.values());
  }

  /** Remove all routines and stop all timers. */
  destroy(): void {
    this.destroyed = true;
    for (const name of this.routines.keys()) {
      this.remove(name);
    }
  }
}
