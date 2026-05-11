import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { hashSimulationRateLimitSubject } from "./simulation-rate-limit";
import {
  buildAdminSimulationLeadPreviewUrl,
  createSupabaseAdminSimulationLeadsStore,
  decryptSimulationLeadEmail,
  encryptSimulationLeadEmail,
  hashSimulationLeadEmail,
} from "./admin-simulation-leads-server";

const EMAIL_SECRET = "email-encryption-secret";
const HASH_SECRET = "email-hash-secret";
const RATE_LIMIT_SALT = "rate-limit-salt";

function createThenableQuery(result: { data: unknown; error?: unknown }) {
  const query = {
    eq: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    neq: vi.fn(() => query),
    not: vi.fn(() => query),
    select: vi.fn(() => query),
    then(resolve: (value: { data: unknown; error?: unknown }) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };

  return query;
}

describe("admin simulation leads server helpers", () => {
  it("decrypts readable email only in server-side code and keeps encrypted payload opaque", () => {
    const encrypted = encryptSimulationLeadEmail(
      "client@example.com",
      EMAIL_SECRET,
    );

    expect(encrypted).not.toContain("client@example.com");
    expect(decryptSimulationLeadEmail(encrypted, EMAIL_SECRET)).toBe(
      "client@example.com",
    );
  });

  it("hashes exact normalized email search with SIMULATION_EMAIL_HASH_SECRET semantics", async () => {
    const rpc = vi.fn(async () => ({
      data: [],
      error: null,
    }));
    const store = createSupabaseAdminSimulationLeadsStore({
      client: {
        rpc,
      },
      emailEncryptionSecret: EMAIL_SECRET,
      emailHashSecret: HASH_SECRET,
      rateLimitSalt: RATE_LIMIT_SALT,
    });

    await store.listLeads({
      email: " Client@Example.COM ",
      limit: 50,
      range: null,
      sort: "newest",
    });

    expect(rpc).toHaveBeenCalledWith(
      "admin_list_simulation_leads",
      expect.objectContaining({
        p_email_normalized_hash: createHmac("sha256", HASH_SECRET)
          .update("client@example.com")
          .digest("hex"),
      }),
    );
  });

  it("computes delete rate-limit cleanup with the same email subject hash as simulation-rate-limit", async () => {
    const encrypted = encryptSimulationLeadEmail(
      "client@example.com",
      EMAIL_SECRET,
    );
    const leadHash = hashSimulationLeadEmail("client@example.com", HASH_SECRET);
    const rpc = vi.fn(async () => ({
      data: null,
      error: null,
    }));
    const client = {
      auth: {
        admin: {
          deleteUser: vi.fn(async () => ({ data: {}, error: null })),
        },
      },
      from: vi
        .fn()
        .mockReturnValueOnce(
          createThenableQuery({
            data: {
              email_address_encrypted: encrypted,
              email_normalized_hash: leadHash,
            },
          }),
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [{ auth_user_id: "auth-user-1" }],
          }),
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [],
          }),
        ),
      rpc,
    };
    const store = createSupabaseAdminSimulationLeadsStore({
      client,
      emailEncryptionSecret: EMAIL_SECRET,
      emailHashSecret: HASH_SECRET,
      rateLimitSalt: RATE_LIMIT_SALT,
    });

    await store.deleteLead("00000000-0000-4000-8000-000000000811");

    expect(rpc).toHaveBeenCalledWith("admin_delete_simulation_lead_identity", {
      p_email_normalized_hash: leadHash,
      p_lead_id: "00000000-0000-4000-8000-000000000811",
      p_rate_limit_subject_hash: hashSimulationRateLimitSubject(
        "client@example.com",
        RATE_LIMIT_SALT,
      ),
    });
  });

  it("deletes transient Auth users before database identity deletion and treats missing users as already cleaned", async () => {
    const encrypted = encryptSimulationLeadEmail(
      "client@example.com",
      EMAIL_SECRET,
    );
    const actions: string[] = [];
    const client = {
      auth: {
        admin: {
          deleteUser: vi.fn(async () => {
            actions.push("delete-auth-user");
            return {
              data: null,
              error: {
                message: "User not found",
                status: 404,
              },
            };
          }),
        },
      },
      from: vi
        .fn()
        .mockReturnValueOnce(
          createThenableQuery({
            data: {
              email_address_encrypted: encrypted,
              email_normalized_hash: hashSimulationLeadEmail(
                "client@example.com",
                HASH_SECRET,
              ),
            },
          }),
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [{ auth_user_id: "auth-user-1" }],
          }),
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [],
          }),
        ),
      rpc: vi.fn(async () => {
        actions.push("database-delete");
        return {
          data: null,
          error: null,
        };
      }),
    };
    const store = createSupabaseAdminSimulationLeadsStore({
      client,
      emailEncryptionSecret: EMAIL_SECRET,
      emailHashSecret: HASH_SECRET,
      rateLimitSalt: RATE_LIMIT_SALT,
    });

    await expect(
      store.deleteLead("00000000-0000-4000-8000-000000000811"),
    ).resolves.toEqual({ deleted: true });
    expect(actions).toEqual(["delete-auth-user", "database-delete"]);
  });

  it("does not delete a transient Auth user when another app record still needs it", async () => {
    const encrypted = encryptSimulationLeadEmail(
      "client@example.com",
      EMAIL_SECRET,
    );
    const deleteUser = vi.fn(async () => ({ data: {}, error: null }));
    const client = {
      auth: {
        admin: {
          deleteUser,
        },
      },
      from: vi
        .fn()
        .mockReturnValueOnce(
          createThenableQuery({
            data: {
              email_address_encrypted: encrypted,
              email_normalized_hash: hashSimulationLeadEmail(
                "client@example.com",
                HASH_SECRET,
              ),
            },
          }),
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [{ auth_user_id: "auth-user-1" }],
          }),
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [{ id: "other-session" }],
          }),
        ),
      rpc: vi.fn(async () => ({ data: null, error: null })),
    };
    const store = createSupabaseAdminSimulationLeadsStore({
      client,
      emailEncryptionSecret: EMAIL_SECRET,
      emailHashSecret: HASH_SECRET,
      rateLimitSalt: RATE_LIMIT_SALT,
    });

    await store.deleteLead("00000000-0000-4000-8000-000000000811");

    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("builds safe catalog preview URLs through the protected admin preview route", () => {
    expect(
      buildAdminSimulationLeadPreviewUrl({
        preparedRenderCellId: "00000000-0000-4000-8000-000000000812",
        preparedSofaAssetId: "00000000-0000-4000-8000-000000000813",
      }),
    ).toBe(
      "/api/admin/storage-assets/00000000-0000-4000-8000-000000000813/preview?variant=medium",
    );
    expect(
      buildAdminSimulationLeadPreviewUrl({
        preparedRenderCellId: "00000000-0000-4000-8000-000000000812",
        preparedSofaAssetId: null,
      }),
    ).toBeNull();
  });
});
