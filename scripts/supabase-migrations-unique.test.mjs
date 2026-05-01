import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = new URL("../supabase/migrations/", import.meta.url);
const MIGRATION_FILE_PATTERN = /^(\d{14})_[a-z0-9_]+\.sql$/;

function listMigrationVersions() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name);
}

describe("supabase/migrations directory", () => {
  it("only contains files matching the timestamp_name.sql convention", () => {
    const offenders = listMigrationVersions().filter(
      (name) => !MIGRATION_FILE_PATTERN.test(name)
    );

    expect(
      offenders,
      `migrations must match <14-digit-timestamp>_name.sql`
    ).toEqual([]);
  });

  it("rejects timestamp prefixes shared by more than one migration", () => {
    const versionsByTimestamp = new Map();

    for (const name of listMigrationVersions()) {
      const match = name.match(MIGRATION_FILE_PATTERN);
      if (!match) {
        continue;
      }
      const [, timestamp] = match;
      const peers = versionsByTimestamp.get(timestamp) ?? [];
      peers.push(name);
      versionsByTimestamp.set(timestamp, peers);
    }

    const collisions = [...versionsByTimestamp.entries()].filter(
      ([, peers]) => peers.length > 1
    );

    expect(
      collisions,
      "Postgres schema_migrations.version is unique per timestamp prefix; renumber clashing files"
    ).toEqual([]);
  });
});
