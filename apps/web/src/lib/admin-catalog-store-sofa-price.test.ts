import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminCatalogStore } from "./admin-catalog";

const mocks = vi.hoisted(() => {
  const sofaId = "00000000-0000-4000-8000-000000000701";
  const tagId = "00000000-0000-4000-8000-000000000801";
  const tag = {
    id: tagId,
    public_label: "Convertible",
    slug: "convertible",
  };
  const baseSofa = {
    archived_at: null,
    created_at: "2026-05-06T09:00:00.000Z",
    depth_cm: 95,
    footprint_measurements: null,
    footprint_type: null,
    height_cm: 82,
    id: sofaId,
    internal_name: "Published sofa",
    lifecycle_state: "published",
    manual_public_order: null,
    price_cents: 129900,
    price_currency: "EUR",
    public_description: "Published copy",
    public_name: "Canape published",
    public_slug: "canape-published",
    shopify_order_url: "https://shopify.example/products/canape-published",
    updated_at: "2026-05-06T09:00:00.000Z",
    length_cm: 220,
  };

  const state = {
    sofa: { ...baseSofa },
    sofaTagDeletes: 0,
    sofaTagInserts: [] as unknown[],
    updateCalls: [] as Array<{ payload: Record<string, unknown>; table: string }>,
  };

  const from = vi.fn((table: string) => {
    const query: Record<string, unknown> = {};

    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.in = vi.fn(async () => {
      if (table === "sofa_tags") {
        return {
          data: [
            {
              public_tags: tag,
              sofa_id: sofaId,
            },
          ],
          error: null,
        };
      }

      return { data: [], error: null };
    });
    query.maybeSingle = vi.fn(async () => {
      if (table === "sofas") {
        return {
          data: state.sofa,
          error: null,
        };
      }

      return { data: null, error: null };
    });
    query.update = vi.fn((payload: Record<string, unknown>) => {
      state.updateCalls.push({ payload, table });

      if (table === "sofas") {
        state.sofa = {
          ...state.sofa,
          ...payload,
          updated_at: "2026-05-06T09:05:00.000Z",
        };
      }

      return query;
    });
    query.delete = vi.fn(() => {
      if (table === "sofa_tags") {
        state.sofaTagDeletes += 1;
      }

      return query;
    });
    query.insert = vi.fn(async (payload: unknown) => {
      if (table === "sofa_tags") {
        state.sofaTagInserts.push(payload);
      }

      return { error: null };
    });

    return query;
  });

  return {
    baseSofa,
    from,
    sofaId,
    state,
    tagId,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mocks.from,
    rpc: vi.fn(),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.sofa = { ...mocks.baseSofa };
  mocks.state.sofaTagDeletes = 0;
  mocks.state.sofaTagInserts = [];
  mocks.state.updateCalls = [];
});

describe("admin catalog sofa price store", () => {
  it("allows published sofa price updates without republishing", async () => {
    const store = createSupabaseAdminCatalogStore({
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    const result = await store.updateSofa(mocks.sofaId, {
      depth_cm: 95,
      height_cm: 82,
      internal_name: "Published sofa",
      length_cm: 220,
      price_cents: 149900,
      public_description: "Published copy",
      public_name: "Canape published",
      shopify_order_url: "https://shopify.example/products/canape-published",
      tag_ids: [mocks.tagId],
    });

    expect(mocks.state.updateCalls).toEqual([
      {
        payload: {
          price_cents: 149900,
        },
        table: "sofas",
      },
    ]);
    expect(mocks.state.sofaTagDeletes).toBe(0);
    expect(mocks.state.sofaTagInserts).toEqual([]);
    expect(result).toMatchObject({
      lifecycle_state: "published",
      price_cents: 149900,
    });
  });

  it("explains that only price can change while a sofa is published", async () => {
    const store = createSupabaseAdminCatalogStore({
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    await expect(
      store.updateSofa(mocks.sofaId, {
        internal_name: "Published sofa",
        price_cents: 149900,
        public_description: "Changed copy",
        tag_ids: [mocks.tagId],
      }),
    ).rejects.toThrow(
      "Only price can be changed while the sofa is published. Unpublish the sofa to edit other basics.",
    );
    expect(mocks.state.updateCalls).toEqual([]);
    expect(mocks.state.sofaTagDeletes).toBe(0);
    expect(mocks.state.sofaTagInserts).toEqual([]);
  });
});
