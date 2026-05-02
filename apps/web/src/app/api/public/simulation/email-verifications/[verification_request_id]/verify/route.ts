import { handleVerifyEmailVerificationRequest } from "../../../../../../../lib/simulation-public-route-handlers";
import { createDefaultSimulationPublicEmailHandlerDeps } from "../../../../../../../lib/simulation-public-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    verification_request_id: string;
  }>;
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { verification_request_id: verificationRequestId } =
    await context.params;
  const body = await readJsonBody(request);
  return handleVerifyEmailVerificationRequest({
    verificationRequestId,
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
