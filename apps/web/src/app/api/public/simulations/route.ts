import { handleCreateSimulationRequest } from "../../../../lib/simulation-public-route-handlers";
import { createDefaultSimulationCreateHandlerDeps } from "../../../../lib/simulation-public-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const clientIp = readClientIp(request);
  return handleCreateSimulationRequest({
    formData,
    headers: request.headers,
    clientIp,
    deps: createDefaultSimulationCreateHandlerDeps()
  });
}

function readClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.length > 0) {
    return realIp;
  }
  return "unknown";
}
