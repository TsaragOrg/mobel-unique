const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "local";

export default function Home() {
  return (
    <main className="shell">
      <section className="panel" aria-labelledby="page-title">
        <p className="eyebrow">Mobel Unique</p>
        <h1 id="page-title">Monorepo foundation is ready.</h1>
        <p>Frontend shell for the public and admin interfaces.</p>
        <dl>
          <dt>Environment</dt>
          <dd>{appEnv}</dd>
          <dt>API</dt>
          <dd>{apiBaseUrl}</dd>
        </dl>
      </section>
    </main>
  );
}

