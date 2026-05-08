import { handleConvertSimulationRoomPhotoPreviewRequest } from "../../../../../lib/simulation-public-route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  return handleConvertSimulationRoomPhotoPreviewRequest({ formData });
}
