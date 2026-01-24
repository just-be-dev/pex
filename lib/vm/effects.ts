/**
 * Algebraic effects and one-shot continuations for the PEX VM
 *
 * Effects are the mechanism by which PEX programs interact with the outside world.
 * When an effect is performed (via the `EFFECT` opcode), the VM:
 * 1. Captures the current execution state (call frames and stack) into a Continuation
 * 2. Suspends execution
 * 3. Calls the host's effect handler with (effectName, args, continuation)
 *
 * The host can then:
 * - Resume the computation by calling `continuation.resume(value)`
 * - Abort the computation by discarding the continuation
 *
 * Continuations are ONE-SHOT: they can only be resumed once. Attempting to resume
 * a continuation twice will throw an error. This design:
 * - Simplifies implementation (no need for stack cloning)
 * - Makes reasoning about control flow easier
 * - Prevents common errors (accidentally resuming multiple times)
 * - Aligns with algebraic effects semantics
 *
 * Example flow:
 * ```
 * PEX: (effect "read" "file.txt")
 *   ↓ VM suspends, captures continuation
 * Host: effectHandler("read", ["file.txt"], continuation)
 *   ↓ Host performs async I/O
 * Host: continuation.resume("file contents")
 *   ↓ VM resumes
 * PEX: (effect "read" "file.txt") evaluates to "file contents"
 * ```
 */

// Re-export Value type from VM values module
export type { Value } from "./values.ts";
import type { Value } from "./values.ts";

/**
 * Call frame - represents a single function call on the call stack
 */
export interface CallFrame {
  /** Function being executed (index into function table) */
  functionIndex: number;
  /** Instruction pointer (offset into code section) */
  ip: number;
  /** Base pointer (where this frame's locals start on the stack) */
  bp: number;
  /** Captured upvalues for closures (null for non-closures) */
  upvalues: Value[] | null;
}

/**
 * One-shot continuation - captures the execution state when an effect is performed
 *
 * A continuation holds the complete state needed to resume execution:
 * - The call stack (frames)
 * - The operand stack (stack)
 * - A flag to enforce one-shot semantics
 *
 * The continuation can be resumed exactly once by calling `resume(value)`.
 * The provided value becomes the result of the effect expression.
 *
 * Attempting to resume a continuation twice will throw an error.
 */
export class Continuation {
  /** Saved call frames */
  private frames: CallFrame[];
  /** Saved operand stack */
  private stack: Value[];
  /** Guard against double-resume */
  private resumed: boolean = false;
  /** Callback to restore VM state and continue execution */
  private readonly resumeCallback: (
    frames: CallFrame[],
    stack: Value[],
    value: Value,
  ) => void;

  constructor(
    frames: CallFrame[],
    stack: Value[],
    resumeCallback: (
      frames: CallFrame[],
      stack: Value[],
      value: Value,
    ) => void,
  ) {
    // Deep copy frames and stack to ensure they're not modified after capture
    this.frames = frames.map((f) => ({
      ...f,
      upvalues: f.upvalues ? f.upvalues.slice() : null,
    }));
    this.stack = stack.slice();
    this.resumeCallback = resumeCallback;
  }

  /**
   * Resume the computation with the given value
   *
   * The value will be pushed onto the stack as the result of the effect expression.
   * The VM will restore its state and continue execution from where it left off.
   *
   * @param value The value to return from the effect
   * @throws Error if the continuation has already been resumed
   */
  resume(value: Value): void {
    if (this.resumed) {
      throw new Error(
        "Continuation has already been resumed. Continuations are one-shot and cannot be resumed twice.",
      );
    }
    this.resumed = true;
    this.resumeCallback(this.frames, this.stack, value);
  }

  /**
   * Check if this continuation has been resumed
   */
  isResumed(): boolean {
    return this.resumed;
  }
}

/**
 * Effect handler function type
 *
 * The host provides an effect handler to process effects performed by PEX code.
 * When an effect is performed, the VM calls this handler with:
 * - effectName: The name of the effect (e.g., "print", "read", "http")
 * - args: The arguments passed to the effect
 * - continuation: A one-shot continuation that can resume the computation
 *
 * The handler should:
 * 1. Perform the effect's action (e.g., I/O, network request, etc.)
 * 2. Call `continuation.resume(value)` with the result when ready
 *    OR discard the continuation to abort the computation
 *
 * The handler returns void - it's responsible for calling continuation.resume()
 * when ready (which may be async).
 *
 * Example:
 * ```typescript
 * const handler: EffectHandler = (name, args, cont) => {
 *   if (name === "print") {
 *     console.log(...args.map(v => displayValue(v)));
 *     cont.resume({ type: "null" });
 *   } else if (name === "read") {
 *     const filename = args[0];
 *     fs.readFile(filename, "utf8", (err, data) => {
 *       if (err) {
 *         // Could abort by not calling resume, or resume with error value
 *         cont.resume({ type: "null" });
 *       } else {
 *         cont.resume({ type: "string", value: data });
 *       }
 *     });
 *   } else {
 *     throw new Error(`Unknown effect: ${name}`);
 *   }
 * };
 * ```
 */
export type EffectHandler = (
  effectName: string,
  args: Value[],
  continuation: Continuation,
) => void;

/**
 * Create a continuation from the current VM state
 *
 * This is a helper function for the VM to create continuations when effects are performed.
 * It captures the current call frames and stack, and provides a callback for resumption.
 *
 * @param frames Current call stack frames
 * @param stack Current operand stack
 * @param resumeCallback Function to call when continuation.resume() is invoked
 * @returns A new Continuation
 */
export function createContinuation(
  frames: CallFrame[],
  stack: Value[],
  resumeCallback: (
    frames: CallFrame[],
    stack: Value[],
    value: Value,
  ) => void,
): Continuation {
  return new Continuation(frames, stack, resumeCallback);
}

/**
 * Default effect handler that throws on any effect
 *
 * This is useful as a default to ensure effects are explicitly handled.
 * A real implementation should provide a proper effect handler.
 */
export const throwingEffectHandler: EffectHandler = (
  effectName,
  _args,
  _continuation,
) => {
  throw new Error(
    `Unhandled effect: ${effectName}. Please provide an EffectHandler to handle effects.`,
  );
};
