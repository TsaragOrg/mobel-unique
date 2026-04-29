import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/quality.yml", "utf8");

describe("Supabase DEV deploy workflow", () => {
  it("applies missing out-of-order migrations without seed data", () => {
    const dbPushLine = workflow
      .split("\n")
      .find((line) => line.includes("supabase db push"));

    expect(dbPushLine).toContain("--include-all");
    expect(dbPushLine).not.toContain("--include-seed");
  });

  it("requires DEV worker secrets before deploying Supabase", () => {
    expect(workflow).toContain(
      "GEMINI_API_KEY: ${{ secrets.SUPABASE_DEV_GEMINI_API_KEY }}",
    );
    expect(workflow).toContain(
      "FABRIC_RENDER_WORKER_INVOKE_SECRET: ${{ secrets.SUPABASE_DEV_FABRIC_RENDER_WORKER_INVOKE_SECRET }}",
    );
    expect(workflow).toContain(
      "FABRIC_RENDER_WORKER_FUNCTION_URL: https://${{ secrets.SUPABASE_DEV_PROJECT_ID }}.supabase.co/functions/v1/fabric-render-worker",
    );
    expect(workflow).toContain('test -n "${GEMINI_API_KEY}"');
    expect(workflow).toContain(
      'test -n "${FABRIC_RENDER_WORKER_INVOKE_SECRET}"',
    );
    expect(workflow).toContain(
      'test -n "${FABRIC_RENDER_WORKER_FUNCTION_URL}"',
    );
  });

  it("sets worker-owned DEV runtime secrets and deploys the fabric render worker", () => {
    const secretsIndex = workflow.indexOf(
      "Set Supabase DEV fabric render worker secrets",
    );
    const deployIndex = workflow.indexOf(
      "Deploy Supabase DEV fabric render worker",
    );

    expect(secretsIndex).toBeGreaterThan(-1);
    expect(deployIndex).toBeGreaterThan(secretsIndex);
    expect(workflow).toContain("supabase secrets set");
    expect(workflow).toContain("APP_ENV=dev");
    expect(workflow).toContain("FABRIC_RENDER_PROVIDER=gemini");
    expect(workflow).toContain(
      "FABRIC_RENDER_PROVIDER_MODEL=gemini-3-pro-image-preview",
    );
    expect(workflow).toContain(
      'FABRIC_RENDER_WORKER_INVOKE_SECRET="${FABRIC_RENDER_WORKER_INVOKE_SECRET}"',
    );
    expect(workflow).toContain('GEMINI_API_KEY="${GEMINI_API_KEY}"');
    expect(workflow).toContain(
      'supabase functions deploy fabric-render-worker --project-ref "${SUPABASE_PROJECT_REF}" --no-verify-jwt',
    );
  });

  it("upserts DEV Vault secrets for the cron runner after deploying the function", () => {
    const deployIndex = workflow.indexOf(
      "Deploy Supabase DEV fabric render worker",
    );
    const vaultIndex = workflow.indexOf(
      "Set Supabase DEV fabric render cron Vault secrets",
    );

    expect(vaultIndex).toBeGreaterThan(deployIndex);
    expect(workflow).toContain("vault.create_secret");
    expect(workflow).toContain("vault.update_secret");
    expect(workflow).toContain("fabric_render_worker_function_url");
    expect(workflow).toContain("fabric_render_worker_invoke_secret");
    expect(workflow).toContain("supabase db query --linked --file");
  });
});
