import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EnvSecretProvider,
  RefusingSecretProvider,
  resolveSecretProvider,
  SecretNotFoundError,
  SecretProviderRefusedError,
} from "../../infra/secret-provider.js";

describe("EnvSecretProvider", () => {
  const envKey = "FKP_SECRET_KLAVIYO_STAGING";

  beforeEach(() => {
    process.env[envKey] = "sk_staging_abc123";
  });

  afterEach(() => {
    delete process.env[envKey];
  });

  it("reads a value set as FKP_SECRET_<NAME>", async () => {
    const provider = new EnvSecretProvider();
    const secret = await provider.get("KLAVIYO_STAGING");
    expect(secret.expose()).toBe("sk_staging_abc123");
  });

  it("rejects a name that has no corresponding env var", async () => {
    const provider = new EnvSecretProvider();
    await expect(provider.get("MISSING")).rejects.toBeInstanceOf(SecretNotFoundError);
  });
});

describe("RefusingSecretProvider", () => {
  it("always refuses, so a misconfigured production deploy fails loudly", async () => {
    const provider = new RefusingSecretProvider();
    await expect(provider.get("ANYTHING")).rejects.toBeInstanceOf(SecretProviderRefusedError);
  });
});

describe("resolveSecretProvider", () => {
  it("resolves EnvSecretProvider for development", () => {
    expect(resolveSecretProvider("development")).toBeInstanceOf(EnvSecretProvider);
  });

  it("resolves RefusingSecretProvider for production — never falls back to env", () => {
    expect(resolveSecretProvider("production")).toBeInstanceOf(RefusingSecretProvider);
  });
});
