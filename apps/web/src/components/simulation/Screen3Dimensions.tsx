"use client";

import { useState } from "react";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import {
  SIMULATION_DIMENSION_MAX_M,
  SIMULATION_DIMENSION_MIN_M,
} from "../../lib/simulation-dimensions";
import type {
  BackWallSuppliedDimensions,
  CornerSuppliedDimensions,
  RoomGeometryMode,
  SuppliedDimensionsBody,
} from "../../lib/simulation-public-api";
import { SimulationContextStrip } from "./SimulationContextStrip";

type SubmitOutcome =
  | { ok: true }
  | { ok: false; code?: string; message?: string };

export interface Screen3DimensionsProps {
  jobId: string;
  sofaName: string;
  fabricName: string;
  visualPositionLabel: string;
  geometryMode: RoomGeometryMode;
  guideImageUrl: string;
  onGuideImageError: () => void;
  onSubmitted: () => void;
  submit?: (
    jobId: string,
    body: SuppliedDimensionsBody,
  ) => Promise<SubmitOutcome>;
}

interface FormValues {
  wallWidth: string;
  wallHeight: string;
  leftWallWidth: string;
  rightWallWidth: string;
  roomHeight: string;
  roomDepth: string;
}

interface DimensionFieldConfig {
  id: string;
  key: keyof FormValues;
  label: string;
}

const EMPTY_FORM: FormValues = {
  wallWidth: "",
  wallHeight: "",
  leftWallWidth: "",
  rightWallWidth: "",
  roomHeight: "",
  roomDepth: "",
};
const DIMENSION_MIN_CM = SIMULATION_DIMENSION_MIN_M * 100;
const DIMENSION_MAX_CM = SIMULATION_DIMENSION_MAX_M * 100;

export function Screen3Dimensions(props: Screen3DimensionsProps) {
  const submit = props.submit ?? defaultSubmit;
  const copy = SIMULATION_LOCALE.screen3Dimensions;
  const fieldConfigs = getFieldConfigs(props.geometryMode);

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function setField<K extends keyof FormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const isValid =
    props.geometryMode === "back_wall"
      ? isPositiveBounded(values.wallWidth) &&
        isPositiveBounded(values.wallHeight) &&
        isPositiveBounded(values.roomDepth)
      : isPositiveBounded(values.leftWallWidth) &&
        isPositiveBounded(values.rightWallWidth) &&
        isPositiveBounded(values.roomHeight) &&
        isPositiveBounded(values.roomDepth);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || submitting) return;
    const body =
      props.geometryMode === "back_wall"
        ? toBackWallBody(values)
        : toCornerBody(values);
    setSubmitting(true);
    setServerError(null);
    const outcome = await submit(props.jobId, body);
    setSubmitting(false);
    if (outcome.ok) {
      props.onSubmitted();
      return;
    }
    setServerError(outcome.message ?? copy.validationOutOfRange);
  }

  return (
    <section className="simulation-dimension-screen">
      <SimulationContextStrip
        sofaName={props.sofaName}
        fabricName={props.fabricName}
        visualPositionLabel={props.visualPositionLabel}
      />

      <header className="simulation-dimension-heading">
        <p className="public-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.instruction}</p>
      </header>

      <div
        aria-label={copy.workspaceAriaLabel}
        className="simulation-dimension-workspace"
        role="group"
      >
        <figure className="simulation-dimension-guide-panel">
          <div className="simulation-dimension-guide">
            <img
              alt={copy.guideImageAlt}
              onError={props.onGuideImageError}
              src={props.guideImageUrl}
            />
          </div>
        </figure>

        <form
          className="simulation-dimension-form"
          onSubmit={onSubmit}
          noValidate
        >
          <div className="simulation-dimension-form-heading">
            <p className="simulation-dimension-section-label">
              {copy.formEyebrow}
            </p>
          </div>

          <div className="simulation-dimension-field-list">
            {fieldConfigs.map((field) => (
              <DimensionField
                id={field.id}
                key={field.id}
                label={field.label}
                onChange={(v) => setField(field.key, v)}
                value={values[field.key]}
              />
            ))}
          </div>

          {serverError ? (
            <p className="simulation-dimension-error" role="alert">
              {serverError}
            </p>
          ) : null}

          <button
            className="public-primary-button"
            disabled={!isValid || submitting}
            type="submit"
          >
            {copy.continueButton}
          </button>
        </form>
      </div>
    </section>
  );
}

function DimensionField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const copy = SIMULATION_LOCALE.screen3Dimensions;
  return (
    <div className="simulation-dimension-field">
      <label htmlFor={props.id}>
        <span>{props.label}</span>
      </label>
      <span className="simulation-dimension-input-wrapper">
        <input
          id={props.id}
          inputMode="decimal"
          max={DIMENSION_MAX_CM}
          min={DIMENSION_MIN_CM}
          onChange={(event) => props.onChange(event.target.value)}
          step="1"
          type="number"
          value={props.value}
        />
        <span aria-hidden="true">{copy.fieldUnitSuffix}</span>
      </span>
    </div>
  );
}

function getFieldConfigs(
  geometryMode: RoomGeometryMode,
): DimensionFieldConfig[] {
  const copy = SIMULATION_LOCALE.screen3Dimensions;
  if (geometryMode === "back_wall") {
    return [
      {
        id: "dim-wall-width",
        key: "wallWidth",
        label: copy.fields.backWall.wallWidth,
      },
      {
        id: "dim-wall-height",
        key: "wallHeight",
        label: copy.fields.backWall.wallHeight,
      },
      {
        id: "dim-room-depth",
        key: "roomDepth",
        label: copy.fields.backWall.roomDepth,
      },
    ];
  }
  return [
    {
      id: "dim-left-wall",
      key: "leftWallWidth",
      label: copy.fields.corner.leftWallWidth,
    },
    {
      id: "dim-right-wall",
      key: "rightWallWidth",
      label: copy.fields.corner.rightWallWidth,
    },
    {
      id: "dim-room-height",
      key: "roomHeight",
      label: copy.fields.corner.roomHeight,
    },
    {
      id: "dim-room-depth",
      key: "roomDepth",
      label: copy.fields.corner.roomDepth,
    },
  ];
}

function isPositiveBounded(raw: string): boolean {
  if (raw.trim() === "") return false;
  const value = Number(raw);
  if (!Number.isFinite(value)) return false;
  return value >= DIMENSION_MIN_CM && value <= DIMENSION_MAX_CM;
}

function toBackWallBody(values: FormValues): BackWallSuppliedDimensions {
  return {
    wall_width: centimetersToMeters(values.wallWidth),
    wall_height: centimetersToMeters(values.wallHeight),
    room_depth: centimetersToMeters(values.roomDepth),
  };
}

function toCornerBody(values: FormValues): CornerSuppliedDimensions {
  return {
    left_wall_width: centimetersToMeters(values.leftWallWidth),
    right_wall_width: centimetersToMeters(values.rightWallWidth),
    room_height: centimetersToMeters(values.roomHeight),
    room_depth: centimetersToMeters(values.roomDepth),
  };
}

function centimetersToMeters(raw: string): number {
  return Number(raw) / 100;
}

async function defaultSubmit(
  jobId: string,
  body: SuppliedDimensionsBody,
): Promise<SubmitOutcome> {
  try {
    const response = await fetch(
      `/api/public/simulations/${encodeURIComponent(jobId)}/dimensions`,
      {
        body: JSON.stringify(body),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    if (response.ok) {
      return { ok: true };
    }
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    return {
      ok: false,
      code: payload?.error?.code,
      message: payload?.error?.message,
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
