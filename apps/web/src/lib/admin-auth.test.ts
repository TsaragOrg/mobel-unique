import { describe, expect, it } from "vitest";
import {
  createAdminAuth,
  hashTrustedDeviceSecret,
  type AdminAuthUser,
  type SupabaseAuthVerifier,
  type TrustedDeviceStore
} from "./admin-auth";

const adminUser: AdminAuthUser = {
  app_metadata: {
    mobel_unique: {
      role: "admin"
    }
  },
  id: "00000000-0000-4000-8000-000000000011",
  user_metadata: {}
};

const nonAdminUser: AdminAuthUser = {
  app_metadata: {},
  id: "00000000-0000-4000-8000-000000000012",
  user_metadata: {}
};

function createAuthVerifier(usersByToken: Record<string, AdminAuthUser | Error>) {
  const verifier: SupabaseAuthVerifier = {
    async getUser(accessToken) {
      const userOrError = usersByToken[accessToken];

      if (userOrError instanceof Error) {
        return {
          error: userOrError,
          user: null
        };
      }

      return {
        error: null,
        user: userOrError ?? null
      };
    }
  };

  return verifier;
}

function createTrustedDeviceStore(activeSecrets: string[] = []) {
  const registrations: Array<{
    authUserId: string;
    deviceTokenHash: string;
    environment: string;
  }> = [];
  const activeHashes = new Set(
    activeSecrets.map((secret) => hashTrustedDeviceSecret(secret, "local"))
  );
  const store: TrustedDeviceStore = {
    async findActiveDevice({ deviceTokenHash }) {
      if (!activeHashes.has(deviceTokenHash)) {
        return null;
      }

      return {
        id: "00000000-0000-4000-8000-000000000013"
      };
    },
    async registerDevice(registration) {
      registrations.push(registration);

      return {
        id: "00000000-0000-4000-8000-000000000014"
      };
    },
    async touchDevice() {}
  };

  return {
    registrations,
    store
  };
}

describe("admin auth helpers", () => {
  it("returns 401 when the access token is missing", async () => {
    const { store } = createTrustedDeviceStore();
    const auth = createAdminAuth({
      authVerifier: createAuthVerifier({}),
      environment: "local",
      trustedDeviceStore: store
    });

    const result = await auth.authorizeRequest({
      authorizationHeader: undefined,
      trustedDeviceSecret: undefined
    });

    expect(result).toMatchObject({
      error: {
        code: "AUTH_REQUIRED",
        message: "Connectez-vous à nouveau pour continuer."
      },
      ok: false,
      status: 401
    });
  });

  it("returns 401 when the bearer token shape is malformed", async () => {
    const { store } = createTrustedDeviceStore();
    const auth = createAdminAuth({
      authVerifier: createAuthVerifier({}),
      environment: "local",
      trustedDeviceStore: store
    });

    const result = await auth.authorizeRequest({
      authorizationHeader: "Token abc",
      trustedDeviceSecret: undefined
    });

    expect(result).toMatchObject({
      error: {
        code: "AUTH_INVALID",
        message: "Votre session admin a expiré. Connectez-vous à nouveau."
      },
      ok: false,
      status: 401
    });
  });

  it("returns 401 for expired, invalid, or wrong-environment tokens", async () => {
    const { store } = createTrustedDeviceStore();
    const auth = createAdminAuth({
      authVerifier: createAuthVerifier({
        "expired-token": new Error("JWT expired"),
        "wrong-environment-token": new Error("invalid issuer")
      }),
      environment: "local",
      trustedDeviceStore: store
    });

    await expect(
      auth.authorizeRequest({
        authorizationHeader: "Bearer expired-token",
        trustedDeviceSecret: undefined
      })
    ).resolves.toMatchObject({
      error: {
        code: "AUTH_INVALID",
        message: "Votre session admin a expiré. Connectez-vous à nouveau."
      },
      ok: false,
      status: 401
    });

    await expect(
      auth.authorizeRequest({
        authorizationHeader: "Bearer wrong-environment-token",
        trustedDeviceSecret: undefined
      })
    ).resolves.toMatchObject({
      error: {
        code: "AUTH_INVALID",
        message: "Votre session admin a expiré. Connectez-vous à nouveau."
      },
      ok: false,
      status: 401
    });
  });

  it("returns 403 for authenticated users without the server-controlled admin claim", async () => {
    const { store } = createTrustedDeviceStore();
    const auth = createAdminAuth({
      authVerifier: createAuthVerifier({
        "non-admin-token": nonAdminUser
      }),
      environment: "local",
      trustedDeviceStore: store
    });

    const result = await auth.authorizeRequest({
      authorizationHeader: "Bearer non-admin-token",
      requireTrustedDevice: false,
      trustedDeviceSecret: undefined
    });

    expect(result).toMatchObject({
      error: {
        code: "ADMIN_REQUIRED",
        message: "Ce compte ne peut pas ouvrir l'espace admin."
      },
      ok: false,
      status: 403
    });
  });

  it("does not grant admin access from user_metadata", async () => {
    const { store } = createTrustedDeviceStore();
    const auth = createAdminAuth({
      authVerifier: createAuthVerifier({
        "user-metadata-token": {
          app_metadata: {},
          id: "00000000-0000-4000-8000-000000000015",
          user_metadata: {
            mobel_unique: {
              role: "admin"
            }
          }
        }
      }),
      environment: "local",
      trustedDeviceStore: store
    });

    const result = await auth.authorizeRequest({
      authorizationHeader: "Bearer user-metadata-token",
      requireTrustedDevice: false,
      trustedDeviceSecret: undefined
    });

    expect(result).toMatchObject({
      error: {
        code: "ADMIN_REQUIRED",
        message: "Ce compte ne peut pas ouvrir l'espace admin."
      },
      ok: false,
      status: 403
    });
  });

  it("grants admin access from app_metadata when the trusted device is active", async () => {
    const { store } = createTrustedDeviceStore(["trusted-device-secret"]);
    const auth = createAdminAuth({
      authVerifier: createAuthVerifier({
        "admin-token": adminUser
      }),
      environment: "local",
      trustedDeviceStore: store
    });

    const result = await auth.authorizeRequest({
      authorizationHeader: "Bearer admin-token",
      trustedDeviceSecret: "trusted-device-secret"
    });

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      user: adminUser
    });
  });

  it("does not store plaintext trusted device secrets", async () => {
    const { registrations, store } = createTrustedDeviceStore();
    const auth = createAdminAuth({
      authVerifier: createAuthVerifier({
        "admin-token": adminUser
      }),
      environment: "local",
      generateDeviceSecret: () => "plain-device-secret",
      trustedDeviceStore: store
    });

    const result = await auth.registerTrustedDevice({
      authorizationHeader: "Bearer admin-token"
    });

    expect(result).toMatchObject({
      deviceSecret: "plain-device-secret",
      ok: true,
      status: 201
    });
    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.deviceTokenHash).not.toBe("plain-device-secret");
    expect(registrations[0]?.deviceTokenHash).toBe(
      hashTrustedDeviceSecret("plain-device-secret", "local")
    );
  });

  it("rejects revoked or unknown trusted devices", async () => {
    const { store } = createTrustedDeviceStore();
    const auth = createAdminAuth({
      authVerifier: createAuthVerifier({
        "admin-token": adminUser
      }),
      environment: "local",
      trustedDeviceStore: store
    });

    const result = await auth.authorizeRequest({
      authorizationHeader: "Bearer admin-token",
      trustedDeviceSecret: "revoked-device-secret"
    });

    expect(result).toMatchObject({
      error: {
        code: "AUTH_INVALID",
        message: "Votre session admin a expiré. Connectez-vous à nouveau."
      },
      ok: false,
      status: 401
    });
  });

  it("does not authorize a trusted device cookie without a Supabase Auth session", async () => {
    const { store } = createTrustedDeviceStore(["trusted-device-secret"]);
    const auth = createAdminAuth({
      authVerifier: createAuthVerifier({}),
      environment: "local",
      trustedDeviceStore: store
    });

    const result = await auth.authorizeRequest({
      authorizationHeader: undefined,
      trustedDeviceSecret: "trusted-device-secret"
    });

    expect(result).toMatchObject({
      error: {
        code: "AUTH_REQUIRED",
        message: "Connectez-vous à nouveau pour continuer."
      },
      ok: false,
      status: 401
    });
  });
});
