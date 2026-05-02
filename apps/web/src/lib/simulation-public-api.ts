// SPEC-0015 PLAN-0040 shared request/response types for the public
// simulation wizard route handlers. These types describe the wire
// shapes; the route handlers and helpers consume them.

export type RoomGeometryMode = "back_wall" | "corner";

export type SimulationJobStatus =
  | "queued"
  | "room_prep_processing"
  | "awaiting_dimensions"
  | "placement_queued"
  | "placement_processing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "expired";

export interface BackWallSuppliedDimensions {
  wall_width: number;
  wall_height: number;
  room_depth: number;
}

export interface CornerSuppliedDimensions {
  left_wall_width: number;
  right_wall_width: number;
  room_height: number;
  room_depth: number;
}

export type SuppliedDimensionsBody =
  | BackWallSuppliedDimensions
  | CornerSuppliedDimensions;

export interface CreateEmailVerificationRequestBody {
  email: string;
  consent_email_use: boolean;
  consent_marketing?: boolean;
}

export interface CreateEmailVerificationResponse {
  verification_request_id: string;
  expires_at: string;
}

export interface VerifyEmailVerificationRequestBody {
  code: string;
}

export interface VerifyEmailVerificationResponse {
  simulation_access_token: string;
  expires_at: string;
}

export interface CreateSimulationResponse {
  simulation_job_id: string;
  status: SimulationJobStatus;
  created_at: string;
  retention_deadline: string;
}

export interface SimulationStatusResponse {
  simulation_job_id: string;
  status: SimulationJobStatus;
  room_geometry_mode: RoomGeometryMode;
  created_at: string;
  retention_deadline: string;
  required_dimensions?:
    | ["wall_width", "wall_height", "room_depth"]
    | ["left_wall_width", "right_wall_width", "room_height", "room_depth"];
  dimension_guide_overlay_url?: string;
  latest_output_url?: string;
  generated_output_count: number;
  regeneration_available: boolean;
  last_error?: string | null;
}

export type SimulationPublicErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "VALIDATION_FAILED"
  | "JOB_NOT_FOUND"
  | "JOB_STATE_CONFLICT"
  | "REGENERATION_LIMIT_REACHED"
  | "INTERNAL_ERROR";

export interface SimulationPublicErrorBody {
  error: {
    code: SimulationPublicErrorCode;
    message: string;
  };
}
