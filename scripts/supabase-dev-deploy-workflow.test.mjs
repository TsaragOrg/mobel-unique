import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/quality.yml", "utf8");

function workflowSection(startMarker, endMarker) {
  const startIndex = workflow.indexOf(startMarker);
  expect(startIndex).toBeGreaterThan(-1);

  const endIndex = endMarker ? workflow.indexOf(endMarker, startIndex + 1) : -1;
  return workflow.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

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

  it("requires DEV in-home simulation worker secrets before deploying Supabase", () => {
    expect(workflow).toContain(
      "OPENAI_API_KEY: ${{ secrets.SUPABASE_DEV_OPENAI_API_KEY }}",
    );
    expect(workflow).toContain(
      "IN_HOME_SIMULATION_WORKER_INVOKE_SECRET: ${{ secrets.SUPABASE_DEV_IN_HOME_SIMULATION_WORKER_INVOKE_SECRET }}",
    );
    expect(workflow).toContain(
      "IN_HOME_SIMULATION_WORKER_FUNCTION_URL: https://${{ secrets.SUPABASE_DEV_PROJECT_ID }}.supabase.co/functions/v1/in-home-simulation-worker",
    );
    expect(workflow).toContain('test -n "${OPENAI_API_KEY}"');
    expect(workflow).toContain(
      'test -n "${IN_HOME_SIMULATION_WORKER_INVOKE_SECRET}"',
    );
    expect(workflow).toContain(
      'test -n "${IN_HOME_SIMULATION_WORKER_FUNCTION_URL}"',
    );
  });

  it("sets worker-owned DEV runtime secrets and deploys the in-home simulation worker", () => {
    const secretsIndex = workflow.indexOf(
      "Set Supabase DEV in-home simulation worker secrets",
    );
    const deployIndex = workflow.indexOf(
      "Deploy Supabase DEV in-home simulation worker",
    );

    expect(secretsIndex).toBeGreaterThan(-1);
    expect(deployIndex).toBeGreaterThan(secretsIndex);
    expect(workflow).toContain("APP_ENV=dev");
    expect(workflow).toContain("IN_HOME_SIMULATION_PROVIDER_MODE=live");
    expect(workflow).toContain(
      'IN_HOME_SIMULATION_WORKER_INVOKE_SECRET="${IN_HOME_SIMULATION_WORKER_INVOKE_SECRET}"',
    );
    expect(workflow).toContain('OPENAI_API_KEY="${OPENAI_API_KEY}"');
    expect(workflow).toContain(
      'supabase functions deploy in-home-simulation-worker --project-ref "${SUPABASE_PROJECT_REF}" --no-verify-jwt',
    );
  });

  it("upserts DEV Vault secrets for the in-home simulation cron runner after deploying the function", () => {
    const deployIndex = workflow.indexOf(
      "Deploy Supabase DEV in-home simulation worker",
    );
    const vaultIndex = workflow.indexOf(
      "Set Supabase DEV in-home simulation cron Vault secrets",
    );

    expect(vaultIndex).toBeGreaterThan(deployIndex);
    expect(workflow).toContain("in_home_simulation_worker_function_url");
    expect(workflow).toContain("in_home_simulation_worker_invoke_secret");
    expect(workflow).toContain(
      "supabase/.temp/in-home-simulation-dev-vault-secrets.sql",
    );
  });

  it("orders the in-home simulation deploy block after the fabric render deploy block", () => {
    const fabricVaultIndex = workflow.indexOf(
      "Set Supabase DEV fabric render cron Vault secrets",
    );
    const inHomeSecretsIndex = workflow.indexOf(
      "Set Supabase DEV in-home simulation worker secrets",
    );

    expect(inHomeSecretsIndex).toBeGreaterThan(fabricVaultIndex);
  });
});

describe("Supabase PROD deploy workflow", () => {
  const prodWorkflow = workflowSection("  supabase-prod:", undefined);

  it("runs only after quality on pushes to main", () => {
    expect(prodWorkflow).toContain("name: Supabase PROD Deploy");
    expect(prodWorkflow).toContain(
      "if: github.event_name == 'push' && github.ref == 'refs/heads/main'",
    );
    expect(prodWorkflow).toContain("      - quality");
    expect(prodWorkflow).toContain('test "${GITHUB_REF_NAME}" = "main"');
  });

  it("uses PROD Supabase secrets and does not reference DEV secrets", () => {
    expect(prodWorkflow).toContain(
      "SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_PROD_DB_PASSWORD }}",
    );
    expect(prodWorkflow).toContain(
      "SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROD_PROJECT_ID }}",
    );
    expect(prodWorkflow).toContain(
      "GEMINI_API_KEY: ${{ secrets.SUPABASE_PROD_GEMINI_API_KEY }}",
    );
    expect(prodWorkflow).toContain(
      "FABRIC_RENDER_WORKER_INVOKE_SECRET: ${{ secrets.SUPABASE_PROD_FABRIC_RENDER_WORKER_INVOKE_SECRET }}",
    );
    expect(prodWorkflow).toContain(
      "OPENAI_API_KEY: ${{ secrets.SUPABASE_PROD_OPENAI_API_KEY }}",
    );
    expect(prodWorkflow).toContain(
      "IN_HOME_SIMULATION_WORKER_INVOKE_SECRET: ${{ secrets.SUPABASE_PROD_IN_HOME_SIMULATION_WORKER_INVOKE_SECRET }}",
    );
    expect(prodWorkflow).not.toContain("SUPABASE_DEV_");
  });

  it("pushes migrations to PROD before deploying Edge Functions", () => {
    const dbPushIndex = prodWorkflow.indexOf("Push Supabase migrations to PROD");
    const fabricSecretsIndex = prodWorkflow.indexOf(
      "Set Supabase PROD fabric render worker secrets",
    );

    expect(dbPushIndex).toBeGreaterThan(-1);
    expect(fabricSecretsIndex).toBeGreaterThan(dbPushIndex);
    expect(prodWorkflow).toContain(
      'pnpm exec supabase db push --password "${SUPABASE_DB_PASSWORD}" --yes --include-all',
    );
    expect(prodWorkflow).not.toContain("--include-seed");
  });

  it("sets PROD fabric render worker secrets, deploys the function, and upserts Vault cron secrets", () => {
    const secretsIndex = prodWorkflow.indexOf(
      "Set Supabase PROD fabric render worker secrets",
    );
    const deployIndex = prodWorkflow.indexOf(
      "Deploy Supabase PROD fabric render worker",
    );
    const vaultIndex = prodWorkflow.indexOf(
      "Set Supabase PROD fabric render cron Vault secrets",
    );

    expect(secretsIndex).toBeGreaterThan(-1);
    expect(deployIndex).toBeGreaterThan(secretsIndex);
    expect(vaultIndex).toBeGreaterThan(deployIndex);
    expect(prodWorkflow).toContain("APP_ENV=prod");
    expect(prodWorkflow).toContain("FABRIC_RENDER_PROVIDER=gemini");
    expect(prodWorkflow).toContain(
      "FABRIC_RENDER_PROVIDER_MODEL=gemini-3-pro-image-preview",
    );
    expect(prodWorkflow).toContain(
      'FABRIC_RENDER_WORKER_INVOKE_SECRET="${FABRIC_RENDER_WORKER_INVOKE_SECRET}"',
    );
    expect(prodWorkflow).toContain('GEMINI_API_KEY="${GEMINI_API_KEY}"');
    expect(prodWorkflow).toContain(
      'supabase functions deploy fabric-render-worker --project-ref "${SUPABASE_PROJECT_REF}" --no-verify-jwt',
    );
    expect(prodWorkflow).toContain(
      "supabase/.temp/fabric-render-prod-vault-secrets.sql",
    );
    expect(prodWorkflow).toContain("fabric_render_worker_function_url");
    expect(prodWorkflow).toContain("fabric_render_worker_invoke_secret");
  });

  it("sets PROD in-home simulation worker secrets, deploys the function, and upserts Vault cron secrets", () => {
    const secretsIndex = prodWorkflow.indexOf(
      "Set Supabase PROD in-home simulation worker secrets",
    );
    const deployIndex = prodWorkflow.indexOf(
      "Deploy Supabase PROD in-home simulation worker",
    );
    const vaultIndex = prodWorkflow.indexOf(
      "Set Supabase PROD in-home simulation cron Vault secrets",
    );

    expect(secretsIndex).toBeGreaterThan(-1);
    expect(deployIndex).toBeGreaterThan(secretsIndex);
    expect(vaultIndex).toBeGreaterThan(deployIndex);
    expect(prodWorkflow).toContain("IN_HOME_SIMULATION_PROVIDER_MODE=live");
    expect(prodWorkflow).toContain(
      'IN_HOME_SIMULATION_WORKER_INVOKE_SECRET="${IN_HOME_SIMULATION_WORKER_INVOKE_SECRET}"',
    );
    expect(prodWorkflow).toContain(
      "IN_HOME_SIMULATION_QUEUE_NAME=local_in_home_simulation_jobs",
    );
    expect(prodWorkflow).toContain("SIMULATION_DAILY_COST_CAP_USD=50");
    expect(prodWorkflow).toContain("OPENAI_FETCH_TIMEOUT_MS=130000");
    expect(prodWorkflow).toContain('OPENAI_API_KEY="${OPENAI_API_KEY}"');
    expect(prodWorkflow).toContain(
      'supabase functions deploy in-home-simulation-worker --project-ref "${SUPABASE_PROJECT_REF}" --no-verify-jwt',
    );
    expect(prodWorkflow).toContain(
      "supabase/.temp/in-home-simulation-prod-vault-secrets.sql",
    );
    expect(prodWorkflow).toContain("in_home_simulation_worker_function_url");
    expect(prodWorkflow).toContain("in_home_simulation_worker_invoke_secret");
  });
});
