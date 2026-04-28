import { createClient } from "@supabase/supabase-js";
import {
  createAdminAuth,
  type AdminAuthUser,
  type AppEnvironment,
  type SupabaseAuthVerifier,
  type TrustedDeviceStore
} from "./admin-auth";

export function createServerAdminAuth() {
  return createAdminAuth({
    authVerifier: createSupabaseAuthVerifier(),
    environment: readAppEnvironment(process.env.NEXT_PUBLIC_APP_ENV),
    trustedDeviceStore: createSupabaseTrustedDeviceStore()
  });
}

export function createSupabaseAuthVerifier(): SupabaseAuthVerifier {
  const client = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return {
    async getUser(accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);

      return {
        error,
        user: data.user
          ? ({
              app_metadata: data.user.app_metadata,
              email: data.user.email,
              id: data.user.id,
              user_metadata: data.user.user_metadata
            } satisfies AdminAuthUser)
          : null
      };
    }
  };
}

export function createSupabaseTrustedDeviceStore(): TrustedDeviceStore {
  const client = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return {
    async findActiveDevice({ authUserId, deviceTokenHash, environment }) {
      const { data, error } = await client
        .from("admin_trusted_devices")
        .select("id")
        .eq("auth_user_id", authUserId)
        .eq("device_token_hash", deviceTokenHash)
        .eq("environment", environment)
        .is("revoked_at", null)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? { id: data.id as string } : null;
    },
    async registerDevice({ authUserId, deviceTokenHash, environment }) {
      const { data, error } = await client
        .from("admin_trusted_devices")
        .insert({
          auth_user_id: authUserId,
          device_token_hash: deviceTokenHash,
          environment
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      return {
        id: data.id as string
      };
    },
    async touchDevice({ id, seenAt }) {
      const { error } = await client
        .from("admin_trusted_devices")
        .update({
          last_seen_at: seenAt.toISOString()
        })
        .eq("id", id);

      if (error) {
        throw error;
      }
    }
  };
}

function readAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === "dev" || value === "prod") {
    return value;
  }

  return "local";
}

function requiredEnv(primaryName: string, fallbackName?: string) {
  const value =
    process.env[primaryName] ?? (fallbackName ? process.env[fallbackName] : "");

  if (!value) {
    throw new Error(`${primaryName} is required.`);
  }

  return value;
}
