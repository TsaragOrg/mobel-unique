import { parseSimulationAccessTokenFromHeaders } from "../../../../../../lib/simulation-access-token";
import { handleGetSimulationRealtimeTokenRequest } from "../../../../../../lib/simulation-public-route-handlers";
import { createDefaultSimulationRealtimeTokenHandlerDeps } from "../../../../../../lib/simulation-public-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ simulation_job_id: string }> }
) {
  const params = await context.params;
  const token = parseSimulationAccessTokenFromHeaders(request.headers);

  return handleGetSimulationRealtimeTokenRequest({
    jobId: params.simulation_job_id,
    token,
    deps: createDefaultSimulationRealtimeTokenHandlerDeps()
  });
}
