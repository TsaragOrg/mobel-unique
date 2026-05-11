import { type createAdminAuth } from "./admin-auth";
import { formatAdminErrorCodeMessage } from "../app/admin/admin-copy";
import {
  encodeAdminSimulationLeadCursor,
  parseAdminSimulationLeadJobsQuery,
  parseAdminSimulationLeadListQuery,
  shapeAdminSimulationLeadJobResponse,
  shapeAdminSimulationLeadResponse,
  type AdminSimulationLeadsStore,
} from "./admin-simulation-leads";

export type { AdminSimulationLeadsStore } from "./admin-simulation-leads";

type AdminAuth = ReturnType<typeof createAdminAuth>;

interface BaseInput {
  adminAuth: AdminAuth;
  authorizationHeader: string | undefined;
  createStore: () => AdminSimulationLeadsStore;
  trustedDeviceSecret: string | undefined;
}

interface RequestInput extends BaseInput {
  request: Request;
}

interface LeadRequestInput extends RequestInput {
  leadId: string;
}

export async function handleListAdminSimulationLeadsRequest(
  input: RequestInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const query = parseAdminSimulationLeadListQuery(
      new URL(input.request.url).searchParams,
    );

    if (!query.ok) {
      return validationResponse(query.error.code, query.status);
    }

    const result = await store.listLeads(query.value);

    return jsonResponse(
      {
        data: {
          leads: result.leads.map(shapeAdminSimulationLeadResponse),
          next_cursor: encodeAdminSimulationLeadCursor(result.nextCursor),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleListAdminSimulationLeadJobsRequest(
  input: LeadRequestInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const query = parseAdminSimulationLeadJobsQuery(
      new URL(input.request.url).searchParams,
    );

    if (!query.ok) {
      return validationResponse(query.error.code, query.status);
    }

    const result = await store.listLeadJobs(input.leadId, query.value);

    if (!result) {
      return notFoundResponse("SIMULATION_LEAD_NOT_FOUND");
    }

    return jsonResponse(
      {
        data: {
          email: result.email,
          jobs: result.jobs.map(shapeAdminSimulationLeadJobResponse),
          matching_job_count: result.matchingJobCount,
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleDeleteAdminSimulationLeadRequest(
  input: LeadRequestInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.deleteLead(input.leadId);

    return jsonResponse(
      {
        data: result,
        meta: {},
      },
      200,
    );
  });
}

async function withAuthorizedStore(
  input: BaseInput,
  callback: (store: AdminSimulationLeadsStore) => Promise<Response>,
) {
  try {
    const authorization = await input.adminAuth.authorizeRequest({
      authorizationHeader: input.authorizationHeader,
      trustedDeviceSecret: input.trustedDeviceSecret,
    });

    if (!authorization.ok) {
      return jsonResponse(
        {
          error: authorization.error,
        },
        authorization.status,
      );
    }

    return await callback(input.createStore());
  } catch {
    return leadErrorResponse("SIMULATION_LEADS_UNAVAILABLE", 500);
  }
}

function validationResponse(code: string, status: number) {
  return leadErrorResponse(code, status);
}

function notFoundResponse(code: string) {
  return leadErrorResponse(code, 404);
}

function leadErrorResponse(code: string, status: number) {
  return jsonResponse(
    {
      error: {
        code,
        message: formatAdminErrorCodeMessage(code),
      },
    },
    status,
  );
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
    status,
  });
}
