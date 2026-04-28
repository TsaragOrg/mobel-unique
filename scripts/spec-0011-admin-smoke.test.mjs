import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./spec-0011-admin-smoke.mjs", import.meta.url)
);

function runSmoke(env, nodeArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...nodeArgs, scriptPath], {
      env: {
        ...process.env,
        ...env
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("close", (status) => {
      resolve({ status, stderr, stdout });
    });
  });
}

function createFetchMock() {
  const cwd = mkdtempSync(join(tmpdir(), "mobel-spec-0011-fetch-mock-"));
  const mockPath = join(cwd, "fetch-mock.mjs");

  writeFileSync(
    mockPath,
    `
globalThis.fetch = async (url, init = {}) => {
  const requestUrl = String(url);

  if (requestUrl.includes("/auth/v1/token")) {
    return new Response(JSON.stringify({
      access_token: "admin-access-token",
      user: {
        app_metadata: {
          mobel_unique: {
            role: "admin"
          }
        },
        id: "00000000-0000-4000-8000-000000000031"
      }
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 200
    });
  }

  if (requestUrl.endsWith("/api/admin/trusted-device")) {
    return new Response(JSON.stringify({
      data: {
        trustedDevice: {
          registered: true
        }
      },
      meta: {}
    }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "__Host-mobel_admin_device=device-secret; Path=/; HttpOnly; Secure; SameSite=Strict"
      },
      status: 201
    });
  }

  if (
    requestUrl.endsWith("/api/admin/session") &&
    init.headers?.Authorization === "Bearer admin-access-token" &&
    init.headers?.Cookie?.includes("__Host-mobel_admin_device=")
  ) {
    return new Response(JSON.stringify({
      data: {
        admin: {
          authenticated: true,
          role: "admin"
        }
      },
      meta: {}
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 200
    });
  }

  return new Response("{}", {
    headers: {
      "Content-Type": "application/json"
    },
    status: 404
  });
};
`
  );

  return mockPath;
}

describe("SPEC-0011 admin smoke script", () => {
  it("skips clearly when local Supabase is not reachable", async () => {
    const result = await runSmoke({
      SPEC_0011_ADMIN_SMOKE_ANON_KEY: "local-anon-key",
      SPEC_0011_ADMIN_SMOKE_SUPABASE_URL: "http://127.0.0.1:1",
      SPEC_0011_ADMIN_SMOKE_TIMEOUT_MS: "250"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP SPEC-0011 admin smoke");
    expect(result.stdout).toContain("pnpm supabase:start");
  });

  it("passes when seeded admin login and trusted device restore succeed", async () => {
    const result = await runSmoke(
      {
        SPEC_0011_ADMIN_SMOKE_ANON_KEY: "local-anon-key",
        SPEC_0011_ADMIN_SMOKE_SUPABASE_URL: "http://127.0.0.1:54321",
        SPEC_0011_ADMIN_SMOKE_WEB_URL: "http://127.0.0.1:3000"
      },
      ["--import", createFetchMock()]
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS SPEC-0011 admin smoke");
    expect(result.stdout).toContain("trusted device restore succeeded");
  });
});
