/**
 * Environment/Scope management for the PEX interpreter
 */

import type { Value } from "./value.ts";

export class Environment {
  private bindings: Map<string, Value>;
  private parent: Environment | null;

  constructor(parent: Environment | null = null) {
    this.bindings = new Map();
    this.parent = parent;
  }

  /**
   * Define a new variable in this environment
   */
  define(name: string, value: Value): void {
    this.bindings.set(name, value);
  }

  /**
   * Look up a variable in this environment or parent environments
   */
  get(name: string): Value | undefined {
    if (this.bindings.has(name)) {
      return this.bindings.get(name);
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    return undefined;
  }

  /**
   * Check if a variable exists in this environment or parent environments
   */
  has(name: string): boolean {
    return this.bindings.has(name) || (this.parent?.has(name) ?? false);
  }

  /**
   * Set an existing variable in this environment or parent environments
   * Returns true if the variable was found and set, false otherwise
   */
  set(name: string, value: Value): boolean {
    if (this.bindings.has(name)) {
      this.bindings.set(name, value);
      return true;
    }
    if (this.parent) {
      return this.parent.set(name, value);
    }
    return false;
  }

  /**
   * Create a new child environment
   */
  extend(): Environment {
    return new Environment(this);
  }

  /**
   * Get all bindings in this environment (not including parent)
   */
  getOwnBindings(): Map<string, Value> {
    return new Map(this.bindings);
  }
}

/**
 * Create a new global environment with built-in functions and constants
 */
export function createGlobalEnvironment(builtins: Map<string, Value>): Environment {
  const env = new Environment();
  for (const [name, value] of builtins) {
    env.define(name, value);
  }
  return env;
}
