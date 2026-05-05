import {
  handleGetSimulationStatusRequest
} from "../../../../../lib/simulation-public-route-handlers";
import { parseSimulationAccessTokenFromHeaders } from "../../../../../lib/simulation-access-token";
import { createDefaultSimulationStatusHandlerDeps } from "../../../../../lib/simulation-public-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    simulation_job_id: string;
  }>;
}

export async function GET(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { simulation_job_id: jobId } = await context.params;
  const token = parseSimulationAccessTokenFromHeaders(request.headers);
  return handleGetSimulationStatusRequest({
    jobId,
    token,
    deps: createDefaultSimulationStatusHandlerDeps()
  });
}
