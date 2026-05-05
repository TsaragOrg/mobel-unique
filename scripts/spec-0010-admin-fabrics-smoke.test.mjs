import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./spec-0010-admin-fabrics-smoke.mjs", import.meta.url),
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
  const cwd = mkdtempSync(
    join(tmpdir(), "mobel-spec-0010-fabrics-fetch-mock-"),
  );
  const mockPath = join(cwd, "fetch-mock.mjs");

  writeFileSync(
    mockPath,
    `
let fabric = null;
let sofaCounter = 0;
const sofas = new Map();
const sofaFabrics = new Map();
const assets = {
  swatch: {
    asset_kind: "fabric_swatch_public",
    byte_size: 68,
    content_type: "image/png",
    height_px: 1,
    id: "00000000-0000-4000-8000-000000000901",
    lifecycle_state: "active",
    visibility: "public",
    width_px: 1
  },
  aiReference: {
    asset_kind: "fabric_ai_reference",
    byte_size: 68,
    content_type: "image/png",
    height_px: 1,
    id: "00000000-0000-4000-8000-000000000902",
    lifecycle_state: "active",
    visibility: "private",
    width_px: 1
  }
};

globalThis.fetch = async (url, init = {}) => {
  const requestUrl = String(url);
  const method = init.method ?? "GET";

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

  if (requestUrl.startsWith("https://storage.example/")) {
    return json({
      Key: "uploaded/fabric.png"
    });
  }

  if (requestUrl.endsWith("/api/admin/uploads") && method === "POST") {
    const payload = JSON.parse(init.body);
    const isSwatch = payload.purpose === "fabric_swatch";

    return json({
      data: {
        upload: {
          expires_at: "2026-04-28T12:00:00.000Z",
          method: "signed_upload",
          signed_upload_url: isSwatch
            ? "https://storage.example/fabric-swatch"
            : "https://storage.example/fabric-ai-reference",
          upload_id: isSwatch ? "swatch-upload" : "ai-reference-upload"
        }
      },
      meta: {}
    }, {
      status: 201
    });
  }

  if (requestUrl.endsWith("/api/admin/uploads/swatch-upload/complete")) {
    return json({
      data: {
        asset: assets.swatch
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/uploads/ai-reference-upload/complete")) {
    return json({
      data: {
        asset: assets.aiReference
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/sofas") && method === "POST") {
    const payload = JSON.parse(init.body);
    sofaCounter += 1;
    const sofa = {
      created_at: "2026-04-28T10:00:00.000Z",
      id: \`00000000-0000-4000-8000-\${String(700 + sofaCounter).padStart(12, "0")}\`,
      internal_name: payload.internal_name,
      lifecycle_state: "draft",
      public_name: payload.public_name ?? null,
      tags: [],
      updated_at: "2026-04-28T10:00:00.000Z"
    };
    sofas.set(sofa.id, sofa);

    return json({
      data: {
        sofa
      },
      meta: {}
    }, {
      status: 201
    });
  }

  if (requestUrl.endsWith("/api/admin/fabrics") && method === "POST") {
    const payload = JSON.parse(init.body);
    fabric = {
      ai_reference_asset: assets.aiReference,
      ai_reference_asset_id: payload.ai_reference_asset_id,
      archived_at: null,
      created_at: "2026-04-28T10:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000903",
      internal_name: payload.internal_name,
      is_premium: payload.is_premium,
      lifecycle_state: "active",
      public_name: payload.public_name,
      swatch_asset: assets.swatch,
      swatch_asset_id: payload.swatch_asset_id,
      updated_at: "2026-04-28T10:00:00.000Z"
    };

    return json({
      data: {
        fabric
      },
      meta: {}
    }, {
      status: 201
    });
  }

  if (requestUrl.endsWith("/api/admin/fabrics") && method === "GET") {
    return json({
      data: {
        fabrics: fabric ? [fabric] : []
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/fabrics/00000000-0000-4000-8000-000000000903/archive")) {
    fabric = {
      ...fabric,
      archived_at: "2026-04-28T10:15:00.000Z",
      lifecycle_state: "archived",
      updated_at: "2026-04-28T10:15:00.000Z"
    };

    return json({
      data: {
        fabric
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/fabrics/00000000-0000-4000-8000-000000000903")) {
    return json({
      data: {
        fabric
      },
      meta: {}
    });
  }

  const sofaFabricMatch = requestUrl.match(/\\/api\\/admin\\/sofas\\/([^/]+)\\/fabrics\\/([^/]+)$/);

  if (sofaFabricMatch && method === "PUT") {
    const [, sofaId, fabricId] = sofaFabricMatch;

    if (fabric?.lifecycle_state === "archived") {
      return json({
        error: {
          code: "FABRIC_ARCHIVED",
          details: {},
          message: "Archived fabrics cannot be assigned to sofas."
        }
      }, {
        status: 409
      });
    }

    const payload = JSON.parse(init.body);
    const assignment = {
      assigned_at: "2026-04-28T10:10:00.000Z",
      fabric,
      fabric_id: fabricId,
      public_order: payload.public_order,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:10:00.000Z"
    };
    sofaFabrics.set(sofaId, [assignment]);

    return json({
      data: {
        sofa_fabric: assignment
      },
      meta: {}
    });
  }

  const sofaFabricsMatch = requestUrl.match(/\\/api\\/admin\\/sofas\\/([^/]+)\\/fabrics$/);

  if (sofaFabricsMatch && method === "GET") {
    const [, sofaId] = sofaFabricsMatch;

    return json({
      data: {
        sofa_fabrics: sofaFabrics.get(sofaId) ?? []
      },
      meta: {}
    });
  }

  const readinessMatch = requestUrl.match(/\\/api\\/admin\\/sofas\\/([^/]+)\\/publication-readiness$/);

  if (readinessMatch) {
    const [, sofaId] = readinessMatch;
    const hasPublicFabric = (sofaFabrics.get(sofaId) ?? []).some(
      (assignment) => assignment.public_order !== null
    );

    return json({
      data: {
        readiness: {
          errors: hasPublicFabric
            ? [
                {
                  code: "INCOMPLETE_PUBLIC_RENDER_COVERAGE",
                  message: "Public render coverage is incomplete."
                }
              ]
            : [
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
`,
  );

  return pathToFileURL(mockPath).href;
}

describe("SPEC-0010 admin fabrics smoke script", () => {
  it("skips clearly when local Supabase is not reachable", async () => {
    const result = await runSmoke({
      SPEC_0010_ADMIN_FABRICS_SMOKE_ANON_KEY: "local-anon-key",
      SPEC_0010_ADMIN_FABRICS_SMOKE_SUPABASE_URL: "http://127.0.0.1:1",
      SPEC_0010_ADMIN_FABRICS_SMOKE_TIMEOUT_MS: "250",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP SPEC-0010 admin fabrics smoke");
    expect(result.stdout).toContain("pnpm supabase:start");
  });

  it("passes when the admin fabrics API flow succeeds", async () => {
    const result = await runSmoke(
      {
        SPEC_0010_ADMIN_FABRICS_SMOKE_ANON_KEY: "local-anon-key",
        SPEC_0010_ADMIN_FABRICS_SMOKE_SUPABASE_URL: "http://127.0.0.1:54321",
        SPEC_0010_ADMIN_FABRICS_SMOKE_WEB_URL: "http://127.0.0.1:3000",
      },
      ["--import", createFetchMock()],
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS SPEC-0010 admin fabrics smoke");
    expect(result.stdout).toContain("created, assigned");
  });
});
