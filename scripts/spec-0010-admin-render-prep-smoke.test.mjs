import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./spec-0010-admin-render-prep-smoke.mjs", import.meta.url),
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
    join(tmpdir(), "mobel-spec-0010-render-prep-fetch-mock-"),
  );
  const mockPath = join(cwd, "fetch-mock.mjs");

  writeFileSync(
    mockPath,
    `
const ids = {
  aiReferenceAsset: "00000000-0000-4000-8000-000000000902",
  column: "00000000-0000-4000-8000-000000000904",
  fabric: "00000000-0000-4000-8000-000000000903",
  job: "00000000-0000-4000-8000-000000000906",
  renderCell: "00000000-0000-4000-8000-000000000905",
  sofa: "00000000-0000-4000-8000-000000000701",
  sourcePhotoAsset: "00000000-0000-4000-8000-000000000907",
  swatchAsset: "00000000-0000-4000-8000-000000000901"
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
        }
      }
    });
  }

  if (requestUrl.endsWith("/api/admin/trusted-device")) {
    return json({ data: {}, meta: {} }, {
      headers: {
        "Set-Cookie": "__Host-mobel_admin_device=device-secret; Path=/; HttpOnly; Secure; SameSite=Strict"
      },
      status: 201
    });
  }

  if (requestUrl.startsWith("https://storage.example/")) {
    return json({ Key: "uploaded.png" });
  }

  if (requestUrl.endsWith("/api/admin/uploads") && method === "POST") {
    const payload = JSON.parse(init.body);
    return json({
      data: {
        upload: {
          expires_at: "2026-04-28T12:00:00.000Z",
          method: "signed_upload",
          signed_upload_url: "https://storage.example/" + payload.purpose,
          upload_id: payload.purpose + "-upload"
        }
      },
      meta: {}
    }, { status: 201 });
  }

  if (requestUrl.includes("/api/admin/uploads/") && requestUrl.endsWith("/complete")) {
    const isSwatch = requestUrl.includes("fabric_swatch");
    const isSource = requestUrl.includes("sofa_source_photo");
    return json({
      data: {
        asset: {
          asset_kind: isSwatch ? "fabric_swatch_public" : isSource ? "sofa_source_photo" : "fabric_ai_reference",
          byte_size: 68,
          content_type: "image/png",
          height_px: 1,
          id: isSwatch ? ids.swatchAsset : isSource ? ids.sourcePhotoAsset : ids.aiReferenceAsset,
          lifecycle_state: "active",
          visibility: isSwatch ? "public" : "private",
          width_px: 1
        }
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/fabrics") && method === "POST") {
    return json({
      data: {
        fabric: {
          id: ids.fabric,
          ai_reference_asset_id: ids.aiReferenceAsset,
          lifecycle_state: "active"
        }
      },
      meta: {}
    }, { status: 201 });
  }

  if (requestUrl.endsWith("/api/admin/sofas") && method === "POST") {
    return json({
      data: {
        sofa: {
          id: ids.sofa,
          lifecycle_state: "draft"
        }
      },
      meta: {}
    }, { status: 201 });
  }

  if (requestUrl.endsWith("/fabrics/" + ids.fabric) && method === "PUT") {
    return json({
      data: {
        sofa_fabric: {
          fabric_id: ids.fabric,
          public_order: 1,
          sofa_id: ids.sofa
        }
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/visual-matrix-columns") && method === "POST") {
    return json({
      data: {
        visual_matrix_column: {
          id: ids.column,
          sequence: 1,
          sofa_id: ids.sofa
        }
      },
      meta: {}
    }, { status: 201 });
  }

  if (requestUrl.endsWith("/render-coverage")) {
    return json({
      data: {
        render_coverage: {
          render_cells: [{
            blockers: [],
            can_generate_initial: true,
            fabric_id: ids.fabric,
            id: ids.renderCell,
            sofa_id: ids.sofa,
            visual_matrix_column_id: ids.column
          }],
          sofa_fabrics: [],
          sofa_id: ids.sofa,
          visual_matrix_columns: []
        }
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/fabric-render-jobs") && method === "POST") {
    return json({
      data: {
        fabric_render_job: {
          id: ids.job,
          status: "queued"
        }
      },
      meta: {}
    }, { status: 201 });
  }

  return json({ data: {}, meta: {} });
};

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    status: init.status ?? 200
  });
}
`,
  );

  return pathToFileURL(mockPath).href;
}

describe("SPEC-0010 admin render prep smoke script", () => {
  it("skips when no local anon key is configured", async () => {
    const result = await runSmoke({
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SPEC_0010_ADMIN_RENDER_PREP_SMOKE_ANON_KEY: "",
      SUPABASE_ANON_KEY: "",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP SPEC-0010 admin render prep smoke");
  });

  it("passes through the mocked render preparation API flow", async () => {
    const mockPath = createFetchMock();
    const result = await runSmoke(
      {
        SPEC_0010_ADMIN_RENDER_PREP_SMOKE_ANON_KEY: "anon-key",
        SPEC_0010_ADMIN_RENDER_PREP_SMOKE_SUPABASE_URL: "http://mock.supabase",
        SPEC_0010_ADMIN_RENDER_PREP_SMOKE_WEB_URL: "http://mock.web",
      },
      ["--import", mockPath],
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS SPEC-0010 admin render prep smoke");
    expect(result.stdout).toContain("00000000-0000-4000-8000-000000000906");
  });
});
