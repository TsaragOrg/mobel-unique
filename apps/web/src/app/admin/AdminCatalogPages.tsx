"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";

type AdminPageState = "checking" | "forbidden" | "ready";

export interface AdminCatalogTag {
  id: string;
  public_label: string;
  slug: string;
}

export interface AdminCatalogSofa {
  created_at: string;
  depth_cm: number | null;
  footprint_measurements: unknown;
  footprint_type: string | null;
  height_cm: number | null;
  id: string;
  internal_name: string;
  lifecycle_state: string;
  manual_public_order: number | null;
  public_description: string | null;
  public_name: string | null;
  public_slug: string | null;
  shopify_order_url: string | null;
  tags: AdminCatalogTag[];
  updated_at: string;
  length_cm: number | null;
}

export interface AdminCatalogReadiness {
  errors: Array<{
    code: string;
    message: string;
  }>;
  ready: boolean;
}

export interface SofaMutationInput {
  depth_cm?: number;
  height_cm?: number;
  internal_name?: string;
  manual_public_order?: number;
  public_description?: string;
  public_name?: string;
  shopify_order_url?: string;
  tag_ids: string[];
  length_cm?: number;
}

export interface TagMutationInput {
  public_label: string;
}

export interface AdminCatalogPageDependencies {
  clearTrustedDevice(): Promise<void>;
  createSofa(
    accessToken: string,
    input: SofaMutationInput,
  ): Promise<AdminCatalogSofa>;
  createTag(
    accessToken: string,
    input: TagMutationInput,
  ): Promise<AdminCatalogTag>;
  deleteTag(accessToken: string, tagId: string): Promise<void>;
  getAccessToken(): Promise<string | null>;
  getSofa(accessToken: string, sofaId: string): Promise<AdminCatalogSofa>;
  getSofaReadiness(
    accessToken: string,
    sofaId: string,
  ): Promise<AdminCatalogReadiness>;
  listSofas(accessToken: string): Promise<AdminCatalogSofa[]>;
  listTags(accessToken: string): Promise<AdminCatalogTag[]>;
  navigate(path: string): void;
  redirect(path: string): void;
  refreshAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
  updateSofa(
    accessToken: string,
    sofaId: string,
    input: SofaMutationInput,
  ): Promise<AdminCatalogSofa>;
  updateTag(
    accessToken: string,
    tagId: string,
    input: TagMutationInput,
  ): Promise<AdminCatalogTag>;
  verifyAdminSession(accessToken: string): Promise<{
    ok: boolean;
    status: number;
  }>;
}

export function AdminSofasPage({
  dependencies,
}: {
  dependencies?: AdminCatalogPageDependencies;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <SofaListContent
          accessToken={accessToken}
          dependencies={activeDependencies}
        />
      )}
    />
  );
}

export function AdminSofaCreatePage({
  dependencies,
}: {
  dependencies?: AdminCatalogPageDependencies;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <SofaCreateContent
          accessToken={accessToken}
          dependencies={activeDependencies}
        />
      )}
    />
  );
}

export function AdminSofaEditPage({
  dependencies,
  sofaId,
}: {
  dependencies?: AdminCatalogPageDependencies;
  sofaId: string;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <SofaEditContent
          accessToken={accessToken}
          dependencies={activeDependencies}
          sofaId={sofaId}
        />
      )}
    />
  );
}

export function AdminTagsPage({
  dependencies,
}: {
  dependencies?: AdminCatalogPageDependencies;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <TagManagerContent
          accessToken={accessToken}
          dependencies={activeDependencies}
        />
      )}
    />
  );
}

export function createDefaultAdminCatalogDependencies(
  navigate: (path: string) => void,
  redirect: (path: string) => void,
): AdminCatalogPageDependencies {
  return {
    async clearTrustedDevice() {
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    },
    async createSofa(accessToken, input) {
      const data = await requestAdminJson(accessToken, "/api/admin/sofas", {
        body: JSON.stringify(input),
        method: "POST",
      });

      return data.sofa as AdminCatalogSofa;
    },
    async createTag(accessToken, input) {
      const data = await requestAdminJson(accessToken, "/api/admin/tags", {
        body: JSON.stringify(input),
        method: "POST",
      });

      return data.tag as AdminCatalogTag;
    },
    async deleteTag(accessToken, tagId) {
      await requestAdminJson(accessToken, `/api/admin/tags/${tagId}`, {
        method: "DELETE",
      });
    },
    async getAccessToken() {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();

      return data.session?.access_token ?? null;
    },
    async getSofa(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}`,
      );

      return data.sofa as AdminCatalogSofa;
    },
    async getSofaReadiness(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/publication-readiness`,
      );

      return data.readiness as AdminCatalogReadiness;
    },
    async listSofas(accessToken) {
      const data = await requestAdminJson(accessToken, "/api/admin/sofas");

      return data.sofas as AdminCatalogSofa[];
    },
    async listTags(accessToken) {
      const data = await requestAdminJson(accessToken, "/api/admin/tags");

      return data.tags as AdminCatalogTag[];
    },
    navigate,
    redirect,
    async refreshAccessToken() {
      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        return null;
      }

      return data.session?.access_token ?? null;
    },
    async signOut() {
      const supabase = getBrowserSupabaseClient();
      await supabase.auth.signOut();
    },
    async updateSofa(accessToken, sofaId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}`,
        {
          body: JSON.stringify(input),
          method: "PATCH",
        },
      );

      return data.sofa as AdminCatalogSofa;
    },
    async updateTag(accessToken, tagId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/tags/${tagId}`,
        {
          body: JSON.stringify(input),
          method: "PATCH",
        },
      );

      return data.tag as AdminCatalogTag;
    },
    async verifyAdminSession(accessToken) {
      return fetch("/api/admin/session", {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    },
  };
}

function ProtectedAdminCatalogPage({
  dependencies,
  render,
}: {
  dependencies?: AdminCatalogPageDependencies;
  render(
    accessToken: string,
    dependencies: AdminCatalogPageDependencies,
  ): ReactNode;
}) {
  const router = useRouter();
  const defaultDependencies = useMemo(
    () =>
      createDefaultAdminCatalogDependencies(
        (path) => router.push(path),
        (path) => router.replace(path),
      ),
    [router],
  );
  const activeDependencies = dependencies ?? defaultDependencies;
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pageState, setPageState] = useState<AdminPageState>("checking");

  useEffect(() => {
    let isCurrent = true;

    async function validateAdminSession() {
      let currentAccessToken: string | null;

      try {
        currentAccessToken = await activeDependencies.getAccessToken();
      } catch {
        activeDependencies.redirect("/admin/login");
        return;
      }

      if (!currentAccessToken) {
        await activeDependencies.clearTrustedDevice();
        activeDependencies.redirect("/admin/login");
        return;
      }

      let response =
        await activeDependencies.verifyAdminSession(currentAccessToken);

      if (response.status === 401) {
        const refreshedAccessToken =
          await activeDependencies.refreshAccessToken();

        if (refreshedAccessToken) {
          currentAccessToken = refreshedAccessToken;
          response =
            await activeDependencies.verifyAdminSession(refreshedAccessToken);
        }
      }

      if (!isCurrent) {
        return;
      }

      if (response.ok) {
        setAccessToken(currentAccessToken);
        setPageState("ready");
        return;
      }

      await activeDependencies.signOut();
      await activeDependencies.clearTrustedDevice();

      if (response.status === 403) {
        setPageState("forbidden");
        return;
      }

      activeDependencies.redirect("/admin/login");
    }

    void validateAdminSession();

    return () => {
      isCurrent = false;
    };
  }, [activeDependencies]);

  if (pageState === "checking") {
    return (
      <main className="admin-workspace" aria-live="polite">
        <p role="status">Checking admin session.</p>
      </main>
    );
  }

  if (pageState === "forbidden") {
    return (
      <main className="admin-workspace">
        <section aria-labelledby="admin-denied-title">
          <p className="eyebrow">Mobel Unique</p>
          <h1 id="admin-denied-title">Admin access unavailable</h1>
          <p>This account is not authorized for the admin area.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-workspace">
      <AdminNavigation />
      {accessToken ? render(accessToken, activeDependencies) : null}
    </main>
  );
}

function SofaListContent({
  accessToken,
  dependencies,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sofas, setSofas] = useState<AdminCatalogSofa[]>([]);

  useEffect(() => {
    let isCurrent = true;

    async function loadSofas() {
      try {
        const nextSofas = await dependencies.listSofas(accessToken);

        if (isCurrent) {
          setSofas(nextSofas);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(readErrorMessage(error));
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadSofas();

    return () => {
      isCurrent = false;
    };
  }, [accessToken, dependencies]);

  return (
    <section aria-labelledby="sofas-title" className="admin-section">
      <div className="admin-heading-row">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 id="sofas-title">Sofas</h1>
        </div>
        <Link className="button-link" href="/admin/sofas/new">
          New sofa
        </Link>
      </div>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isLoading ? <p role="status">Loading sofas.</p> : null}
      {!isLoading && sofas.length === 0 ? <p>No sofas.</p> : null}
      {sofas.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>State</th>
                <th>Slug</th>
                <th>Shopify</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sofas.map((sofa) => (
                <tr key={sofa.id}>
                  <td>{sofa.internal_name || sofa.public_name}</td>
                  <td>{sofa.lifecycle_state}</td>
                  <td>{sofa.public_slug ?? "None"}</td>
                  <td>{sofa.shopify_order_url ? "Set" : "Missing"}</td>
                  <td>{formatTimestamp(sofa.updated_at)}</td>
                  <td>
                    <Link href={`/admin/sofas/${sofa.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function SofaCreateContent({
  accessToken,
  dependencies,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tags, setTags] = useState<AdminCatalogTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    void dependencies
      .listTags(accessToken)
      .then(setTags)
      .catch((error) => setErrorMessage(readErrorMessage(error)));
  }, [accessToken, dependencies]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = buildSofaPayload(formData, selectedTagIds);

    try {
      const sofa = await dependencies.createSofa(accessToken, payload);
      dependencies.navigate(`/admin/sofas/${sofa.id}`);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="create-sofa-title" className="admin-section">
      <p className="eyebrow">Catalog</p>
      <h1 id="create-sofa-title">Create sofa</h1>
      <SofaForm
        buttonLabel={isSubmitting ? "Creating" : "Create draft"}
        errorMessage={errorMessage}
        onSelectedTagIdsChange={setSelectedTagIds}
        onSubmit={handleSubmit}
        selectedTagIds={selectedTagIds}
        tags={tags}
      />
    </section>
  );
}

function SofaEditContent({
  accessToken,
  dependencies,
  sofaId,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  sofaId: string;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [readiness, setReadiness] = useState<AdminCatalogReadiness | null>(
    null,
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [sofa, setSofa] = useState<AdminCatalogSofa | null>(null);
  const [tags, setTags] = useState<AdminCatalogTag[]>([]);

  useEffect(() => {
    let isCurrent = true;

    async function loadSofa() {
      try {
        const [nextSofa, nextTags, nextReadiness] = await Promise.all([
          dependencies.getSofa(accessToken, sofaId),
          dependencies.listTags(accessToken),
          dependencies.getSofaReadiness(accessToken, sofaId),
        ]);

        if (isCurrent) {
          setSofa(nextSofa);
          setTags(nextTags);
          setReadiness(nextReadiness);
          setSelectedTagIds(nextSofa.tags.map((tag) => tag.id));
          setErrorMessage(null);
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(readErrorMessage(error));
        }
      }
    }

    void loadSofa();

    return () => {
      isCurrent = false;
    };
  }, [accessToken, dependencies, sofaId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = buildSofaPayload(formData, selectedTagIds);

    try {
      const nextSofa = await dependencies.updateSofa(
        accessToken,
        sofaId,
        payload,
      );
      const nextReadiness = await dependencies.getSofaReadiness(
        accessToken,
        sofaId,
      );
      setSofa(nextSofa);
      setReadiness(nextReadiness);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!sofa && !errorMessage) {
    return (
      <section className="admin-section" aria-live="polite">
        <p role="status">Loading sofa.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="edit-sofa-title" className="admin-section">
      <p className="eyebrow">Catalog</p>
      <h1 id="edit-sofa-title">{sofa?.internal_name ?? "Sofa"}</h1>
      <div className="admin-grid">
        <div>
          {sofa ? (
            <SofaForm
              buttonLabel={isSubmitting ? "Saving" : "Save sofa"}
              errorMessage={errorMessage}
              onSelectedTagIdsChange={setSelectedTagIds}
              onSubmit={handleSubmit}
              selectedTagIds={selectedTagIds}
              sofa={sofa}
              tags={tags}
            />
          ) : null}
        </div>
        <aside className="admin-aside" aria-labelledby="readiness-title">
          <h2 id="readiness-title">Publication readiness</h2>
          {readiness?.ready ? <p>Ready</p> : <p>Blocked</p>}
          {readiness?.errors.length ? (
            <ul className="admin-list">
              {readiness.errors.map((error) => (
                <li key={error.code}>
                  <strong>{error.code}</strong>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function TagManagerContent({
  accessToken,
  dependencies,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<string | null>(
    null,
  );
  const [tags, setTags] = useState<AdminCatalogTag[]>([]);

  async function loadTags() {
    const nextTags = await dependencies.listTags(accessToken);
    setTags(nextTags);
  }

  useEffect(() => {
    void loadTags().catch((error) => setErrorMessage(readErrorMessage(error)));
  }, [accessToken, dependencies]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const publicLabel = String(formData.get("public_label") ?? "").trim();

    try {
      await dependencies.createTag(accessToken, {
        public_label: publicLabel,
      });
      event.currentTarget.reset();
      await loadTags();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(tag: AdminCatalogTag, form: HTMLFormElement) {
    setErrorMessage(null);
    const formData = new FormData(form);
    const publicLabel = String(formData.get(`tag-${tag.id}`) ?? "").trim();

    try {
      await dependencies.updateTag(accessToken, tag.id, {
        public_label: publicLabel,
      });
      await loadTags();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  async function handleDelete(tag: AdminCatalogTag) {
    setErrorMessage(null);

    try {
      await dependencies.deleteTag(accessToken, tag.id);
      setPendingDeleteTagId(null);
      await loadTags();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  return (
    <section aria-labelledby="tags-title" className="admin-section">
      <p className="eyebrow">Catalog</p>
      <h1 id="tags-title">Tags</h1>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <form className="admin-inline-form" onSubmit={handleCreate}>
        <label className="field">
          <span>Public label</span>
          <input name="public_label" required />
        </label>
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating" : "Create tag"}
        </button>
      </form>
      {tags.length === 0 ? <p>No tags.</p> : null}
      <div className="admin-list">
        {tags.map((tag) => (
          <form
            className="admin-list-row"
            key={tag.id}
            onSubmit={(event) => {
              event.preventDefault();
              void handleUpdate(tag, event.currentTarget);
            }}
          >
            <label className="field">
              <span>Edit {tag.public_label}</span>
              <input
                aria-label={`Edit ${tag.public_label}`}
                defaultValue={tag.public_label}
                name={`tag-${tag.id}`}
                required
              />
            </label>
            <span className="admin-muted">{tag.slug}</span>
            <button type="submit">Save {tag.public_label}</button>
            {pendingDeleteTagId === tag.id ? (
              <button onClick={() => void handleDelete(tag)} type="button">
                Confirm delete {tag.public_label}
              </button>
            ) : (
              <button
                onClick={() => setPendingDeleteTagId(tag.id)}
                type="button"
              >
                Delete {tag.public_label}
              </button>
            )}
          </form>
        ))}
      </div>
    </section>
  );
}

function SofaForm({
  buttonLabel,
  errorMessage,
  onSelectedTagIdsChange,
  onSubmit,
  selectedTagIds,
  sofa,
  tags,
}: {
  buttonLabel: string;
  errorMessage: string | null;
  onSelectedTagIdsChange(tagIds: string[]): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  selectedTagIds: string[];
  sofa?: AdminCatalogSofa;
  tags: AdminCatalogTag[];
}) {
  function handleTagToggle(tagId: string) {
    if (selectedTagIds.includes(tagId)) {
      onSelectedTagIdsChange(selectedTagIds.filter((id) => id !== tagId));
      return;
    }

    onSelectedTagIdsChange([...selectedTagIds, tagId]);
  }

  return (
    <form className="admin-form admin-form-wide" onSubmit={onSubmit}>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <label className="field">
        <span>Internal name</span>
        <input
          defaultValue={sofa?.internal_name ?? ""}
          name="internal_name"
          required
        />
      </label>
      <label className="field">
        <span>Public name</span>
        <input defaultValue={sofa?.public_name ?? ""} name="public_name" />
      </label>
      <label className="field">
        <span>Shopify order URL</span>
        <input
          defaultValue={sofa?.shopify_order_url ?? ""}
          name="shopify_order_url"
          type="url"
        />
      </label>
      <label className="field">
        <span>Public description</span>
        <textarea
          defaultValue={sofa?.public_description ?? ""}
          name="public_description"
          rows={4}
        />
      </label>
      <div className="admin-form-grid">
        <label className="field">
          <span>Length cm</span>
          <input
            defaultValue={sofa?.length_cm ?? ""}
            min="1"
            name="length_cm"
            type="number"
          />
        </label>
        <label className="field">
          <span>Depth cm</span>
          <input
            defaultValue={sofa?.depth_cm ?? ""}
            min="1"
            name="depth_cm"
            type="number"
          />
        </label>
        <label className="field">
          <span>Height cm</span>
          <input
            defaultValue={sofa?.height_cm ?? ""}
            min="1"
            name="height_cm"
            type="number"
          />
        </label>
      </div>
      <fieldset className="admin-fieldset">
        <legend>Tags</legend>
        {tags.length === 0 ? <p>No tags.</p> : null}
        <div className="admin-checkboxes">
          {tags.map((tag) => (
            <label key={tag.id}>
              <input
                checked={selectedTagIds.includes(tag.id)}
                onChange={() => handleTagToggle(tag.id)}
                type="checkbox"
              />
              <span>{tag.public_label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit">{buttonLabel}</button>
    </form>
  );
}

function AdminNavigation() {
  return (
    <nav className="admin-nav" aria-label="Admin">
      <Link href="/admin">Dashboard</Link>
      <Link href="/admin/sofas">Sofas</Link>
      <Link href="/admin/tags">Tags</Link>
    </nav>
  );
}

function buildSofaPayload(
  formData: FormData,
  selectedTagIds: string[],
): SofaMutationInput {
  const payload: SofaMutationInput = {
    tag_ids: selectedTagIds,
  };

  for (const field of [
    "internal_name",
    "public_name",
    "shopify_order_url",
    "public_description",
  ] as const) {
    const value = String(formData.get(field) ?? "").trim();

    if (value) {
      payload[field] = value;
    }
  }

  for (const field of ["length_cm", "depth_cm", "height_cm"] as const) {
    const value = String(formData.get(field) ?? "").trim();

    if (value) {
      payload[field] = Number(value);
    }
  }

  return payload;
}

async function requestAdminJson(
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) {
    if (!response.ok) {
      throw new Error("Request failed.");
    }

    return {};
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.error?.code ?? body.error?.message ?? "Request failed.",
    );
  }

  return body.data ?? {};
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
