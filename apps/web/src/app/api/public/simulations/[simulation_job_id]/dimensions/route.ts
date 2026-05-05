import { handleSubmitDimensionsRequest } from "../../../../../../lib/simulation-public-route-handlers";
import { parseSimulationAccessTokenFromHeaders } from "../../../../../../lib/simulation-access-token";
import { createDefaultSimulationDimensionsHandlerDeps } from "../../../../../../lib/simulation-public-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    simulation_job_id: string;
  }>;
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { simulation_job_id: jobId } = await context.params;
  const token = parseSimulationAccessTokenFromHeaders(request.headers);
  const body = await readJsonBody(request);
  return handleSubmitDimensionsRequest({
    jobId,
    token,
    body,
    deps: createDefaultSimulationDimensionsHandlerDeps()
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
