import { handleCreateEmailVerificationRequest } from "../../../../../lib/simulation-public-route-handlers";
import { createDefaultSimulationPublicEmailHandlerDeps } from "../../../../../lib/simulation-public-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  return handleCreateEmailVerificationRequest({
    body,
    deps: createDefaultSimulationPublicEmailHandlerDeps()
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
