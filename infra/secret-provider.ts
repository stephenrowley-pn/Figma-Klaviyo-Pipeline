import { Secret } from "../packages/contracts/src/secret.js";

/**
 * How the running pipeline reads a secret value (a per-client Klaviyo API
 * key, a Figma PAT). See ADR 0003: GitHub Actions secrets serve CI only —
 * this interface is what the running application reads from, and the real
 * implementation (a cloud secrets manager) is a one-file change against it,
 * deferred until M7.
 */
export interface SecretProvider {
  get(name: string): Promise<Secret<string>>;
}

export class SecretNotFoundError extends Error {
  constructor(name: string) {
    super(`secret "${name}" is not available from this SecretProvider`);
    this.name = "SecretNotFoundError";
  }
}

export class SecretProviderRefusedError extends Error {
  constructor() {
    super(
      "no production SecretProvider is configured — refusing to start rather than falling back to an env var",
    );
    this.name = "SecretProviderRefusedError";
  }
}

/** Development-only: reads `FKP_SECRET_<NAME>` from the environment. */
export class EnvSecretProvider implements SecretProvider {
  get(name: string): Promise<Secret<string>> {
    const envKey = `FKP_SECRET_${name}`;
    const value = process.env[envKey];
    if (value === undefined) {
      return Promise.reject(new SecretNotFoundError(name));
    }
    return Promise.resolve(new Secret(value));
  }
}

/**
 * The production default until a real secrets-manager implementation is
 * wired in. Always refuses, so a misconfigured production deploy fails
 * loudly at startup rather than silently falling back to an env var.
 */
export class RefusingSecretProvider implements SecretProvider {
  get(_name: string): Promise<Secret<string>> {
    return Promise.reject(new SecretProviderRefusedError());
  }
}

export type RuntimeEnvironment = "development" | "production";

export function resolveSecretProvider(environment: RuntimeEnvironment): SecretProvider {
  return environment === "development" ? new EnvSecretProvider() : new RefusingSecretProvider();
}
