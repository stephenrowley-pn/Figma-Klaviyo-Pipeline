const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");

const REDACTED = "[REDACTED Secret]";

/**
 * Wraps a sensitive value (a Klaviyo API key, a Figma PAT) so it cannot leak
 * through structured logging, `JSON.stringify`, template-literal
 * interpolation or `console.log`/`util.inspect`. The only way to read the
 * real value is the explicit `.expose()` call, which is easy to grep for.
 */
export class Secret<T = string> {
  readonly #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  expose(): T {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspectSymbol](): string {
    return REDACTED;
  }
}
