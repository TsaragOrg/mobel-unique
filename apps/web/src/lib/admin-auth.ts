import { createHash, randomBytes } from "node:crypto";

export const ADMIN_ROLE = "admin";
export const ADMIN_TRUSTED_DEVICE_COOKIE = "__Host-mobel_admin_device";

export type AppEnvironment = "dev" | "local" | "prod";

export type AdminAuthErrorCode =
  | "ADMIN_REQUIRED"
  | "AUTH_INVALID"
  | "AUTH_REQUIRED";

export interface AdminAuthUser {
  app_metadata?: Record<string, unknown> | null;
  email?: string | null;
  id: string;
  user_metadata?: Record<string, unknown> | null;
}

export interface SupabaseAuthVerifier {
  getUser(accessToken: string): Promise<{
    error: unknown | null;
    user: AdminAuthUser | null;
  }>;
}

export interface TrustedDeviceRecord {
  id: string;
}

export interface TrustedDeviceStore {
  findActiveDevice(input: {
    authUserId: string;
    deviceTokenHash: string;
    environment: AppEnvironment;
  }): Promise<TrustedDeviceRecord | null>;
  registerDevice(input: {
    authUserId: string;
    deviceTokenHash: string;
    environment: AppEnvironment;
  }): Promise<TrustedDeviceRecord>;
  touchDevice(input: {
    id: string;
    seenAt: Date;
  }): Promise<void>;
}

export interface AdminAuthSuccess {
  ok: true;
  status: 200;
  trustedDeviceId?: string;
  user: AdminAuthUser;
}

export interface AdminAuthFailure {
  error: {
    code: AdminAuthErrorCode;
    message: string;
  };
  ok: false;
  status: 401 | 403;
}

export type AdminAuthorizationResult = AdminAuthFailure | AdminAuthSuccess;

export interface TrustedDeviceRegistrationSuccess {
  deviceSecret: string;
  ok: true;
  status: 201;
  trustedDeviceId: string;
  user: AdminAuthUser;
}

export type TrustedDeviceRegistrationResult =
  | AdminAuthFailure
  | TrustedDeviceRegistrationSuccess;

interface CreateAdminAuthOptions {
  authVerifier: SupabaseAuthVerifier;
  environment: AppEnvironment;
  generateDeviceSecret?: () => string;
  now?: () => Date;
  trustedDeviceStore: TrustedDeviceStore;
}

export function hashTrustedDeviceSecret(
  deviceSecret: string,
  environment: AppEnvironment
) {
  return createHash("sha256")
    .update(`mobel-unique-admin-device:v1:${environment}:${deviceSecret}`)
    .digest("hex");
}

export function generateTrustedDeviceSecret() {
  return randomBytes(32).toString("base64url");
}

export function createAdminAuth({
  authVerifier,
  environment,
  generateDeviceSecret = generateTrustedDeviceSecret,
  now = () => new Date(),
  trustedDeviceStore
}: CreateAdminAuthOptions) {
  async function authorizeRequest(input: {
    authorizationHeader: string | undefined;
    requireTrustedDevice?: boolean;
    trustedDeviceSecret: string | undefined;
  }): Promise<AdminAuthorizationResult> {
    const accessTokenResult = extractBearerToken(input.authorizationHeader);

    if (!accessTokenResult.ok) {
      return accessTokenResult;
    }

    const { error, user } = await authVerifier.getUser(
      accessTokenResult.accessToken
    );

    if (error || !user) {
      return authInvalid();
    }

    if (!hasAdminClaim(user)) {
      return adminRequired();
    }

    if (input.requireTrustedDevice !== false) {
      if (!input.trustedDeviceSecret) {
        return authRequired();
      }

      const deviceTokenHash = hashTrustedDeviceSecret(
        input.trustedDeviceSecret,
        environment
      );
      const trustedDevice = await trustedDeviceStore.findActiveDevice({
        authUserId: user.id,
        deviceTokenHash,
        environment
      });

      if (!trustedDevice) {
        return authInvalid();
      }

      await trustedDeviceStore.touchDevice({
        id: trustedDevice.id,
        seenAt: now()
      });

      return {
        ok: true,
        status: 200,
        trustedDeviceId: trustedDevice.id,
        user
      };
    }

    return {
      ok: true,
      status: 200,
      user
    };
  }

  async function registerTrustedDevice(input: {
    authorizationHeader: string | undefined;
  }): Promise<TrustedDeviceRegistrationResult> {
    const authorization = await authorizeRequest({
      authorizationHeader: input.authorizationHeader,
      requireTrustedDevice: false,
      trustedDeviceSecret: undefined
    });

    if (!authorization.ok) {
      return authorization;
    }

    const deviceSecret = generateDeviceSecret();
    const deviceTokenHash = hashTrustedDeviceSecret(deviceSecret, environment);
    const trustedDevice = await trustedDeviceStore.registerDevice({
      authUserId: authorization.user.id,
      deviceTokenHash,
      environment
    });

    return {
      deviceSecret,
      ok: true,
      status: 201,
      trustedDeviceId: trustedDevice.id,
      user: authorization.user
    };
  }

  return {
    authorizeRequest,
    registerTrustedDevice
  };
}

function extractBearerToken(
  authorizationHeader: string | undefined
):
  | AdminAuthFailure
  | {
      accessToken: string;
      ok: true;
    } {
  if (!authorizationHeader) {
    return authRequired();
  }

  const parts = authorizationHeader.trim().split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0]?.toLowerCase() !== "bearer" ||
    !parts[1]
  ) {
    return authInvalid();
  }

  return {
    accessToken: parts[1],
    ok: true
  };
}

function hasAdminClaim(user: AdminAuthUser) {
  const mobelUniqueClaim = user.app_metadata?.mobel_unique;

  if (!isRecord(mobelUniqueClaim)) {
    return false;
  }

  return mobelUniqueClaim.role === ADMIN_ROLE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function authRequired(): AdminAuthFailure {
  return {
    error: {
      code: "AUTH_REQUIRED",
      message: "Authentication is required."
    },
    ok: false,
    status: 401
  };
}

function authInvalid(): AdminAuthFailure {
  return {
    error: {
      code: "AUTH_INVALID",
      message: "Authentication is invalid."
    },
    ok: false,
    status: 401
  };
}

function adminRequired(): AdminAuthFailure {
  return {
    error: {
      code: "ADMIN_REQUIRED",
      message: "Admin access is required."
    },
    ok: false,
    status: 403
  };
}
