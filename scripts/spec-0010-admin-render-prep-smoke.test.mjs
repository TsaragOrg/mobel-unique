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
  candidate: "00000000-0000-4000-8000-000000000908",
  column: "00000000-0000-4000-8000-000000000904",
  job: "00000000-0000-4000-8000-000000000906",
  manualRenderAsset: "00000000-0000-4000-8000-000000000909",
  sourceFabric: "00000000-0000-4000-8000-000000000903",
  sourceRenderCell: "00000000-0000-4000-8000-000000000905",
  sofa: "00000000-0000-4000-8000-000000000701",
  sourcePhotoAsset: "00000000-0000-4000-8000-000000000907",
  swatchAsset: "00000000-0000-4000-8000-000000000901",
  targetFabric: "00000000-0000-4000-8000-000000000910",
  targetRenderCell: "00000000-0000-4000-8000-000000000911"
};

let fabricCreateCount = 0;

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
    const isManualRender = requestUrl.includes("manual_render");
    return json({
      data: {
        asset: {
          asset_kind: isSwatch ? "fabric_swatch_public" : isSource ? "sofa_source_photo" : isManualRender ? "manual_render" : "fabric_ai_reference",
          byte_size: 68,
          content_type: "image/png",
          height_px: 1,
          id: isSwatch ? ids.swatchAsset : isSource ? ids.sourcePhotoAsset : isManualRender ? ids.manualRenderAsset : ids.aiReferenceAsset,
          lifecycle_state: "active",
          visibility: isSwatch ? "public" : "private",
          width_px: 1
        }
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/fabrics") && method === "POST") {
    fabricCreateCount += 1;
    return json({
      data: {
        fabric: {
          id: fabricCreateCount === 1 ? ids.sourceFabric : ids.targetFabric,
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

  if ((requestUrl.endsWith("/fabrics/" + ids.sourceFabric) || requestUrl.endsWith("/fabrics/" + ids.targetFabric)) && method === "PUT") {
    const fabricId = requestUrl.endsWith("/fabrics/" + ids.sourceFabric) ? ids.sourceFabric : ids.targetFabric;
    return json({
      data: {
        sofa_fabric: {
          fabric_id: fabricId,
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
          render_cells: [
            {
              blockers: ["SOURCE_PHOTO_RENDER_COMPLETE"],
              can_generate_initial: false,
              candidate_count: 0,
              current_private_asset_id: ids.sourcePhotoAsset,
              fabric_id: ids.sourceFabric,
              has_private_render: true,
              id: ids.sourceRenderCell,
              sofa_id: ids.sofa,
              source_photo_id: "00000000-0000-4000-8000-000000000912",
              source_type: "source_photo",
              visual_matrix_column_id: ids.column
            },
            {
              blockers: [],
              can_generate_initial: true,
              candidate_count: 1,
              fabric_id: ids.targetFabric,
              has_private_render: false,
              id: ids.targetRenderCell,
              sofa_id: ids.sofa,
              source_type: "ai_generated",
              visual_matrix_column_id: ids.column
            }
          ],
          sofa_fabrics: [],
          sofa_id: ids.sofa,
          visual_matrix_columns: []
        }
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/fabric-render-jobs") && method === "POST") {
    const payload = JSON.parse(init.body);

    if (payload.fabric_id === ids.sourceFabric) {
      return json({
        error: {
          code: "FABRIC_RENDER_JOB_CONFLICT",
          message: "The source photo already satisfies the original fabric render cell."
        },
        meta: {}
      }, { status: 422 });
    }

    return json({
      data: {
        fabric_render_job: {
          id: ids.job,
          render_cell_id: ids.targetRenderCell,
          status: "queued"
        }
      },
      meta: {}
    }, { status: 201 });
  }

  if (requestUrl.endsWith("/api/admin/render-cells/" + ids.targetRenderCell + "/candidates")) {
    return json({
      data: {
        render_candidates: [{
          asset: {
            asset_kind: "fabric_render_candidate",
            byte_size: 68,
            content_type: "image/png",
            height_px: 1,
            id: ids.sourcePhotoAsset,
            lifecycle_state: "active",
            visibility: "private",
            width_px: 1
          },
          asset_id: ids.sourcePhotoAsset,
          created_at: "2026-04-28T10:35:00.000Z",
          fabric_id: ids.targetFabric,
          generation_mode: "initial",
          id: ids.candidate,
          is_current: false,
          job_id: ids.job,
          preview_url: "https://storage.example/private-candidate-preview",
          prompt_version: "v007",
          provider_model: "mock-fabric-render-v1",
          provider_name: "mock",
          render_cell_id: ids.targetRenderCell,
          sofa_id: ids.sofa,
          visual_matrix_column_id: ids.column
        }]
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/render-candidates/" + ids.candidate + "/use-as-current")) {
    return json({
      data: {
        render_candidate: {
          id: ids.candidate,
          is_current: true,
          render_cell_id: ids.targetRenderCell
        }
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/admin/render-cells/" + ids.targetRenderCell + "/manual-render")) {
    return json({
      data: {
        render_cell: {
          current_private_asset_id: ids.manualRenderAsset,
          current_public_asset_id: null,
          id: ids.targetRenderCell,
          source_type: "manual_upload"
        }
      },
      meta: {}
    });
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
    expect(result.stdout).toContain("00000000-0000-4000-8000-000000000908");
    expect(result.stdout).toContain("00000000-0000-4000-8000-000000000909");
  });
});
