/*
RU: Этот файл нужен для рабочего экрана лидов. Админ видит проверку входа, фильтры, строки email, окно заявок и подтверждение удаления. Здесь можно искать email, менять даты, смотреть безопасные заявки и удалять email из записей сайта.
FR: Ce fichier sert a l'ecran de travail des leads. L'admin voit le controle d'entree, les filtres, les lignes email, la fenetre des demandes et la confirmation. Ici on peut chercher un email, changer les dates, voir les demandes sures et retirer l'email des traces du site.
*/

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../../lib/supabase-browser";
import { ADMIN_COPY } from "../admin-copy";
import { AdminPageHeader, AdminShell } from "../AdminShell";

type AdminLeadPagePhase = "checking" | "forbidden" | "ready";
type AdminLeadLoadPhase = "idle" | "loading" | "failed";

export type AdminLeadSort = "newest" | "oldest";
export type AdminLeadRange = "day" | "week" | "month";

export interface AdminLeadQuery {
  email?: string;
  from?: string;
  range?: AdminLeadRange;
  sort: AdminLeadSort;
  to?: string;
}

export interface AdminLeadListItem {
  email: string;
  last_simulation_at: string;
  lead_id: string;
  matching_job_count: number;
}

export interface AdminLeadListResponse {
  leads: AdminLeadListItem[];
  next_cursor: string | null;
}

export interface AdminLeadJobItem {
  fabric_name: string;
  preview_image_url: string | null;
  simulation_date: string;
  sofa_name: string;
  status_label: string;
  visual_position_label: string | null;
}

export interface AdminLeadJobsResponse {
  email: string;
  jobs: AdminLeadJobItem[];
  matching_job_count: number;
}

export interface AdminSimulationLeadsDashboardDependencies {
  clearTrustedDevice(): Promise<void>;
  deleteLead(accessToken: string, leadId: string): Promise<{ deleted: true }>;
  getAccessToken(): Promise<string | null>;
  listLeadJobs(
    accessToken: string,
    leadId: string,
    query: AdminLeadQuery,
  ): Promise<AdminLeadJobsResponse>;
  listLeads(
    accessToken: string,
    query: AdminLeadQuery,
  ): Promise<AdminLeadListResponse>;
  redirect(path: string): void;
  refreshAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
  verifyAdminSession(accessToken: string): Promise<{
    ok: boolean;
    status: number;
  }>;
}

const INITIAL_QUERY: AdminLeadQuery = {
  sort: "newest",
};

export default function AdminSimulationLeadsDashboard({
  dependencies,
}: {
  dependencies?: AdminSimulationLeadsDashboardDependencies;
}) {
  // RU: Эта связь меняет адрес страницы при выходе или отказе.
  // FR: Ce lien change l'adresse de la page lors de la sortie ou du refus.
  const router = useRouter();
  // RU: Эти действия приходят с настоящего сайта, если тест не дал свои.
  // FR: Ces actions viennent du vrai site si le test n'en donne pas.
  const defaultDependencies = useMemo(
    () => createDefaultDependencies((path) => router.replace(path)),
    [router],
  );
  // RU: Этот набор действий проверяет вход, загружает лиды и удаляет email.
  // FR: Ce groupe d'actions controle l'entree, charge les leads et retire un email.
  const activeDependencies = dependencies ?? defaultDependencies;
  // RU: Эта отметка решает, какой экран показывать сейчас.
  // FR: Cette valeur decide quel ecran afficher maintenant.
  const [pagePhase, setPagePhase] = useState<AdminLeadPagePhase>("checking");
  // RU: Здесь хранится ключ входа для запросов к закрытым адресам.
  // FR: Ici se garde la cle d'entree pour les adresses protegees.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // RU: Этот список содержит безопасные строки email для таблицы.
  // FR: Cette liste garde les lignes email sures pour le tableau.
  const [leads, setLeads] = useState<AdminLeadListItem[]>([]);
  // RU: Эта отметка показывает загрузку или ошибку списка.
  // FR: Cette valeur montre le chargement ou l'erreur de la liste.
  const [listPhase, setListPhase] = useState<AdminLeadLoadPhase>("idle");
  // RU: Эти выбранные фильтры отправляются при загрузке списка.
  // FR: Ces choix de filtre sont envoyes pendant le chargement de la liste.
  const [query, setQuery] = useState<AdminLeadQuery>(INITIAL_QUERY);
  // RU: Это поле хранит текст email до поиска.
  // FR: Ce champ garde le texte email avant la recherche.
  const [emailInput, setEmailInput] = useState("");
  // RU: Эти поля хранят даты до применения.
  // FR: Ces champs gardent les dates avant l'application.
  const [dateInputs, setDateInputs] = useState({
    from: "",
    to: "",
  });
  // RU: Эта строка открывает подтверждение удаления.
  // FR: Cette ligne ouvre la confirmation de retrait.
  const [confirmingLeadId, setConfirmingLeadId] = useState<string | null>(null);
  // RU: Эти данные управляют одним окном заявок.
  // FR: Ces donnees controlent une seule fenetre de demandes.
  const [jobsDialog, setJobsDialog] = useState<{
    email: string;
    error: boolean;
    jobs: AdminLeadJobItem[];
    lead: AdminLeadListItem;
    loading: boolean;
    matchingJobCount: number;
  } | null>(null);

  // RU: Этот блок сам проверяет вход при открытии страницы.
  // FR: Ce bloc controle seul l'entree quand la page s'ouvre.
  useEffect(() => {
    let isCurrent = true;

    async function validateAdminSession() {
      let token: string | null;

      try {
        token = await activeDependencies.getAccessToken();
      } catch {
        activeDependencies.redirect("/admin/login");
        return;
      }

      if (!token) {
        await activeDependencies.clearTrustedDevice();
        activeDependencies.redirect("/admin/login");
        return;
      }

      let response = await activeDependencies.verifyAdminSession(token);

      if (response.status === 401) {
        const refreshedAccessToken =
          await activeDependencies.refreshAccessToken();

        if (refreshedAccessToken) {
          token = refreshedAccessToken;
          response = await activeDependencies.verifyAdminSession(token);
        }
      }

      if (!isCurrent) {
        return;
      }

      if (response.ok) {
        setAccessToken(token);
        setPagePhase("ready");
        await loadLeads(token, INITIAL_QUERY);
        return;
      }

      await activeDependencies.signOut();
      await activeDependencies.clearTrustedDevice();

      if (response.status === 403) {
        setPagePhase("forbidden");
        return;
      }

      activeDependencies.redirect("/admin/login");
    }

    void validateAdminSession();

    return () => {
      isCurrent = false;
    };
  }, [activeDependencies]);

  // RU: Этот блок закрывает окно заявок по клавише Escape.
  // FR: Ce bloc ferme la fenetre des demandes avec la touche Escape.
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setJobsDialog(null);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function loadLeads(token: string, nextQuery: AdminLeadQuery) {
    setListPhase("loading");

    try {
      const response = await activeDependencies.listLeads(token, nextQuery);
      setLeads(response.leads);
      setListPhase("idle");
    } catch {
      setLeads([]);
      setListPhase("failed");
    }
  }

  // RU: Это действие ставит быстрый выбор даты и обновляет список.
  // FR: Cette action choisit une date rapide et recharge la liste.
  function handleRangeChange(range: AdminLeadRange) {
    if (!accessToken) {
      return;
    }

    const nextQuery = {
      range,
      sort: query.sort,
    };
    setQuery(nextQuery);
    void loadLeads(accessToken, nextQuery);
  }

  // RU: Это действие применяет выбранные даты.
  // FR: Cette action applique les dates choisies.
  function handleApplyDates() {
    if (!accessToken) {
      return;
    }

    const nextQuery = {
      from: dateInputs.from || undefined,
      sort: query.sort,
      to: dateInputs.to || undefined,
    };
    setQuery(nextQuery);
    void loadLeads(accessToken, nextQuery);
  }

  // RU: Это действие меняет порядок строк.
  // FR: Cette action change l'ordre des lignes.
  function handleSortChange(sort: AdminLeadSort) {
    if (!accessToken) {
      return;
    }

    const nextQuery = {
      ...query,
      sort,
    };
    setQuery(nextQuery);
    void loadLeads(accessToken, nextQuery);
  }

  // RU: Это действие ищет точный email.
  // FR: Cette action cherche l'email exact.
  function handleSearch() {
    if (!accessToken) {
      return;
    }

    const email = emailInput.trim().toLowerCase();
    const nextQuery = {
      ...query,
      ...(email ? { email } : {}),
    };
    setQuery(nextQuery);
    setEmailInput(email);
    void loadLeads(accessToken, nextQuery);
  }

  // RU: Это действие очищает фильтры и возвращает весь список.
  // FR: Cette action efface les filtres et remet toute la liste.
  function handleClearFilters() {
    if (!accessToken) {
      return;
    }

    setEmailInput("");
    setDateInputs({
      from: "",
      to: "",
    });
    setQuery(INITIAL_QUERY);
    void loadLeads(accessToken, INITIAL_QUERY);
  }

  // RU: Это действие открывает окно заявок для выбранного email.
  // FR: Cette action ouvre la fenetre des demandes pour l'email choisi.
  async function handleOpenJobs(lead: AdminLeadListItem) {
    if (!accessToken) {
      return;
    }

    setJobsDialog({
      email: lead.email,
      error: false,
      jobs: [],
      lead,
      loading: true,
      matchingJobCount: lead.matching_job_count,
    });

    try {
      const response = await activeDependencies.listLeadJobs(
        accessToken,
        lead.lead_id,
        query,
      );
      setJobsDialog({
        email: response.email,
        error: false,
        jobs: response.jobs,
        lead,
        loading: false,
        matchingJobCount: response.matching_job_count,
      });
    } catch {
      setJobsDialog({
        email: lead.email,
        error: true,
        jobs: [],
        lead,
        loading: false,
        matchingJobCount: lead.matching_job_count,
      });
    }
  }

  // RU: Это действие удаляет email после подтверждения.
  // FR: Cette action retire l'email apres confirmation.
  async function handleConfirmDelete(lead: AdminLeadListItem) {
    if (!accessToken) {
      return;
    }

    await activeDependencies.deleteLead(accessToken, lead.lead_id);
    setLeads((current) =>
      current.filter((item) => item.lead_id !== lead.lead_id),
    );
    setConfirmingLeadId(null);
  }

  if (pagePhase === "checking") {
    // RU: Этот экран виден, пока вход еще проверяется.
    // FR: Cet ecran apparait pendant le controle d'entree.
    return (
      <AdminShell showNavigation={false} variant="auth">
        <section className="admin-auth-card" aria-live="polite">
          <p className="admin-status-text" role="status">
            {ADMIN_COPY.auth.checkingSession}
          </p>
        </section>
      </AdminShell>
    );
  }

  if (pagePhase === "forbidden") {
    // RU: Этот экран сообщает, что аккаунт не может войти в админку.
    // FR: Cet ecran indique que le compte ne peut pas entrer dans l'admin.
    return (
      <AdminShell showNavigation={false} variant="auth">
        <section
          className="admin-auth-card"
          aria-labelledby="admin-leads-denied-title"
        >
          <AdminPageHeader
            description={ADMIN_COPY.auth.deniedDescription}
            eyebrow={ADMIN_COPY.auth.deniedEyebrow}
            title={ADMIN_COPY.auth.deniedTitle}
            titleId="admin-leads-denied-title"
          />
        </section>
      </AdminShell>
    );
  }

  const emptyMessage =
    query.email && leads.length === 0
      ? ADMIN_COPY.leads.empty.noEmailMatch
      : (query.range || query.from || query.to) && leads.length === 0
        ? ADMIN_COPY.leads.empty.noFilteredLeads
        : ADMIN_COPY.leads.empty.noRetainedLeads;

  // RU: Главная зона показывает фильтры, таблицу email и окно заявок.
  // FR: La zone principale affiche les filtres, le tableau email et la fenetre.
  return (
    <AdminShell>
      <section className="admin-leads-page" aria-labelledby="admin-leads-title">
        <AdminPageHeader
          description={ADMIN_COPY.leads.page.description}
          eyebrow={ADMIN_COPY.leads.page.eyebrow}
          title={ADMIN_COPY.leads.page.title}
          titleId="admin-leads-title"
        />

        <section className="admin-leads-filters" aria-label="Filtres leads">
          <div className="admin-leads-filter-row" role="group">
            <button type="button" onClick={() => handleRangeChange("day")}>
              {ADMIN_COPY.leads.actions.lastDay}
            </button>
            <button type="button" onClick={() => handleRangeChange("week")}>
              {ADMIN_COPY.leads.actions.lastWeek}
            </button>
            <button type="button" onClick={() => handleRangeChange("month")}>
              {ADMIN_COPY.leads.actions.lastMonth}
            </button>
          </div>
          <div className="admin-leads-filter-row">
            <label>
              {ADMIN_COPY.leads.labels.from}
              <input
                onChange={(event) =>
                  setDateInputs((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
                type="date"
                value={dateInputs.from}
              />
            </label>
            <label>
              {ADMIN_COPY.leads.labels.to}
              <input
                onChange={(event) =>
                  setDateInputs((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
                type="date"
                value={dateInputs.to}
              />
            </label>
            <button type="button" onClick={handleApplyDates}>
              {ADMIN_COPY.leads.actions.applyDates}
            </button>
          </div>
          <div className="admin-leads-filter-row">
            <label>
              {ADMIN_COPY.leads.labels.sort}
              <select
                onChange={(event) =>
                  handleSortChange(event.target.value as AdminLeadSort)
                }
                value={query.sort}
              >
                <option value="newest">{ADMIN_COPY.leads.sort.newest}</option>
                <option value="oldest">{ADMIN_COPY.leads.sort.oldest}</option>
              </select>
            </label>
            <label>
              {ADMIN_COPY.leads.labels.exactEmail}
              <input
                onChange={(event) => setEmailInput(event.target.value)}
                type="email"
                value={emailInput}
              />
            </label>
            <button type="button" onClick={handleSearch}>
              {ADMIN_COPY.leads.actions.search}
            </button>
            <button type="button" onClick={handleClearFilters}>
              {ADMIN_COPY.leads.actions.clear}
            </button>
          </div>
        </section>

        {/* RU: Этот список показывает только email, дату, число заявок и удаление.
            FR: Cette liste montre seulement email, date, nombre de demandes et retrait. */}
        <section className="admin-leads-list" aria-live="polite">
          {listPhase === "loading" ? (
            <p>{ADMIN_COPY.leads.text.loading}</p>
          ) : null}
          {listPhase === "failed" ? (
            <p role="alert">{ADMIN_COPY.leads.errors.listLoadFailed}</p>
          ) : null}
          {listPhase !== "failed" && leads.length === 0 ? (
            <p>{emptyMessage}</p>
          ) : null}
          {leads.length > 0 ? (
            <div className="admin-leads-table-wrap">
              <table className="admin-leads-table">
                <thead>
                  <tr>
                    <th>{ADMIN_COPY.leads.labels.email}</th>
                    <th>{ADMIN_COPY.leads.labels.lastSimulation}</th>
                    <th>{ADMIN_COPY.leads.labels.jobs}</th>
                    <th>{ADMIN_COPY.leads.labels.deleteLead}</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.lead_id}>
                      <td>{lead.email}</td>
                      <td>{formatAdminLeadDate(lead.last_simulation_at)}</td>
                      <td>
                        <button type="button" onClick={() => void handleOpenJobs(lead)}>
                          {formatJobCount(lead.matching_job_count)}
                        </button>
                      </td>
                      <td>
                        {confirmingLeadId === lead.lead_id ? (
                          <div className="admin-leads-delete-confirm">
                            <p>{ADMIN_COPY.leads.text.deleteConfirm}</p>
                            <button type="button" onClick={() => setConfirmingLeadId(null)}>
                              {ADMIN_COPY.leads.actions.cancelDelete}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleConfirmDelete(lead)}
                            >
                              {ADMIN_COPY.leads.actions.confirmDelete}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingLeadId(lead.lead_id)}
                          >
                            {ADMIN_COPY.leads.actions.delete} {lead.email}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </section>

      {jobsDialog ? (
        <div className="admin-leads-dialog-scrim">
          <section
            aria-labelledby="admin-leads-dialog-title"
            className="admin-leads-dialog"
            role="dialog"
          >
            <header className="admin-leads-dialog-header">
              <h2 id="admin-leads-dialog-title">
                {jobsDialog.email} - {formatJobCount(jobsDialog.matchingJobCount)}
              </h2>
              <button type="button" onClick={() => setJobsDialog(null)}>
                {ADMIN_COPY.leads.actions.close}
              </button>
            </header>
            {jobsDialog.loading ? <p>{ADMIN_COPY.leads.text.loading}</p> : null}
            {jobsDialog.error ? (
              <p role="alert">{ADMIN_COPY.leads.errors.jobsLoadFailed}</p>
            ) : null}
            <div className="admin-leads-job-list">
              {jobsDialog.jobs.map((job) => (
                <article
                  className="admin-leads-job-card"
                  key={`${job.sofa_name}-${job.fabric_name}-${job.simulation_date}`}
                >
                  <div className="admin-leads-preview">
                    {job.preview_image_url ? (
                      <img
                        alt={[
                          job.sofa_name,
                          job.fabric_name,
                          job.visual_position_label,
                        ]
                          .filter(Boolean)
                          .join(" - ")}
                        src={job.preview_image_url}
                      />
                    ) : (
                      <span>{ADMIN_COPY.leads.empty.noPreview}</span>
                    )}
                  </div>
                  <div>
                    <h3>{job.sofa_name}</h3>
                    <p>{job.fabric_name}</p>
                    <p>{job.visual_position_label}</p>
                    <p>{formatAdminLeadDate(job.simulation_date)}</p>
                    <p>{job.status_label}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}

function formatJobCount(count: number) {
  return `${count} ${count === 1 ? "job" : "jobs"}`;
}

function formatAdminLeadDate(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCFullYear()),
  ].join("/") + ` ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function createDefaultDependencies(
  redirect: (path: string) => void,
): AdminSimulationLeadsDashboardDependencies {
  return {
    async clearTrustedDevice() {
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    },
    async deleteLead(accessToken, leadId) {
      const response = await fetch(`/api/admin/simulation-leads/${leadId}`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "DELETE",
      });
      const body = await readAdminJson(response);

      return body.data;
    },
    async getAccessToken() {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();

      return data.session?.access_token ?? null;
    },
    async listLeadJobs(accessToken, leadId, query) {
      const response = await fetch(
        `/api/admin/simulation-leads/${leadId}/jobs${buildLeadQueryString(query)}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      const body = await readAdminJson(response);

      return body.data;
    },
    async listLeads(accessToken, query) {
      const response = await fetch(
        `/api/admin/simulation-leads${buildLeadQueryString(query)}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      const body = await readAdminJson(response);

      return body.data;
    },
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
    async verifyAdminSession(accessToken) {
      return fetch("/api/admin/session", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    },
  };
}

async function readAdminJson(response: Response) {
  const body = await response.json();

  if (!response.ok) {
    throw new Error("Admin lead request failed");
  }

  return body;
}

function buildLeadQueryString(query: AdminLeadQuery) {
  const params = new URLSearchParams();

  if (query.range) {
    params.set("range", query.range);
  }

  if (query.from) {
    params.set("from", query.from);
  }

  if (query.to) {
    params.set("to", query.to);
  }

  if (query.email) {
    params.set("email", query.email);
  }

  if (query.sort && query.sort !== "newest") {
    params.set("sort", query.sort);
  }

  const serialized = params.toString();

  return serialized ? `?${serialized}` : "";
}
