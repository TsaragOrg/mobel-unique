import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./spec-0010-admin-catalog-smoke.mjs", import.meta.url),
);

function runSmoke(env, nodeArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...nodeArgs, scriptPath], {
      env: {
        ...process.env,
        ...env,
      },
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
  const cwd = mkdtempSync(join(tmpdir(), "mobel-spec-0010-fetch-mock-"));
  const mockPath = join(cwd, "fetch-mock.mjs");

  writeFileSync(
    mockPath,
    `
let tag = null;
let sofa = null;

globalThis.fetch = async (url, init = {}) => {
  const requestUrl = String(url);

  if (requestUrl.includes("/auth/v1/token")) {
    return json({
      access_token: "admin-access-token",
      user: {
        app_metadata: {
          mobel_unique: {
            role: "admin"
          }
        },
        id: "00000000-0000-4000-8000-000000000401"
      }
    });
  }

  if (requestUrl.endsWith("/api/admin/trusted-device")) {
    return json({
      data: {
        trustedDevice: {
          registered: true
        }
      },
      meta: {}
    }, {
      headers: {
        "Set-Cookie": "__Host-mobel_admin_device=device-secret; Path=/; HttpOnly; Secure; SameSite=Strict"
      },
      status: 201
    });
  }

  if (requestUrl.endsWith("/api/admin/tags") && init.method === "POST") {
    const payload = JSON.parse(init.body);
    tag = {
      id: "00000000-0000-4000-8000-000000000501",
      public_label: payload.public_label,
      slug: slugify(payload.public_label)
    };

    return json({
      data: {
        tag
      },
      meta: {}
    }, {
      status: 201
    });
  }

  if (requestUrl.endsWith("/api/admin/sofas") && init.method === "POST") {
    const payload = JSON.parse(init.body);
    sofa = {
      created_at: "2026-04-28T10:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000601",
      internal_name: payload.internal_name,
      lifecycle_state: "draft",
      public_description: null,
      public_name: payload.public_name,
      public_slug: null,
      tags: [tag],
      updated_at: "2026-04-28T10:00:00.000Z"
    };

    return json({
      data: {
        sofa
      },
      meta: {}
    }, {
      status: 201
    });
  }

  if (requestUrl.endsWith("/api/admin/sofas") && !init.method) {
    return json({
      data: {
        sofas: [sofa]
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/sofas/00000000-0000-4000-8000-000000000601")) {
    if (init.method === "PATCH") {
      const payload = JSON.parse(init.body);
      sofa = {
        ...sofa,
        public_description: payload.public_description
      };

      return json({
        data: {
          sofa
        },
        meta: {}
      });
    }

    return json({
      data: {
        sofa
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/sofas/00000000-0000-4000-8000-000000000601/publication-readiness")) {
    return json({
      data: {
        readiness: {
          errors: [
            {
              code: "MISSING_PUBLIC_FABRIC",
              message: "At least one active public fabric is required."
            }
          ],
          ready: false
        }
      },
      meta: {}
    });
  }

  return json({}, {
    status: 404
  });
};

function json(body, options = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    status: options.status ?? 200
  });
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tag";
}
`,
  );

  return pathToFileURL(mockPath).href;
}

describe("SPEC-0010 admin catalog smoke script", () => {
  it("skips clearly when local Supabase is not reachable", async () => {
    const result = await runSmoke({
      SPEC_0010_ADMIN_CATALOG_SMOKE_ANON_KEY: "local-anon-key",
      SPEC_0010_ADMIN_CATALOG_SMOKE_SUPABASE_URL: "http://127.0.0.1:1",
      SPEC_0010_ADMIN_CATALOG_SMOKE_TIMEOUT_MS: "250",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP SPEC-0010 admin catalog smoke");
    expect(result.stdout).toContain("pnpm supabase:start");
  });

  it("passes when the admin catalog API flow succeeds", async () => {
    const result = await runSmoke(
      {
        SPEC_0010_ADMIN_CATALOG_SMOKE_ANON_KEY: "local-anon-key",
        SPEC_0010_ADMIN_CATALOG_SMOKE_SUPABASE_URL: "http://127.0.0.1:54321",
        SPEC_0010_ADMIN_CATALOG_SMOKE_WEB_URL: "http://127.0.0.1:3000",
      },
      ["--import", createFetchMock()],
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS SPEC-0010 admin catalog smoke");
    expect(result.stdout).toContain("created, read, updated");
  });
});
