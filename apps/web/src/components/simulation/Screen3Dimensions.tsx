"use client";

import { useState } from "react";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import {
  SIMULATION_DIMENSION_MAX_M,
  SIMULATION_DIMENSION_MIN_M
} from "../../lib/simulation-dimensions";
import type {
  BackWallSuppliedDimensions,
  CornerSuppliedDimensions,
  RoomGeometryMode,
  SuppliedDimensionsBody
} from "../../lib/simulation-public-api";
import { SimulationContextStrip } from "./SimulationContextStrip";

type SubmitOutcome = { ok: true } | { ok: false; code?: string; message?: string };

export interface Screen3DimensionsProps {
  jobId: string;
  sofaName: string;
  fabricName: string;
  visualPositionLabel: string;
  geometryMode: RoomGeometryMode;
  guideImageUrl: string;
  onGuideImageError: () => void;
  onSubmitted: () => void;
  submit?: (jobId: string, body: SuppliedDimensionsBody) => Promise<SubmitOutcome>;
}

interface FormValues {
  wallWidth: string;
  wallHeight: string;
  leftWallWidth: string;
  rightWallWidth: string;
  roomHeight: string;
  roomDepth: string;
}

const EMPTY_FORM: FormValues = {
  wallWidth: "",
  wallHeight: "",
  leftWallWidth: "",
  rightWallWidth: "",
  roomHeight: "",
  roomDepth: ""
};

export function Screen3Dimensions(props: Screen3DimensionsProps) {
  const submit = props.submit ?? defaultSubmit;
  const copy = SIMULATION_LOCALE.screen3Dimensions;
  const fields =
    props.geometryMode === "back_wall"
      ? copy.fields.backWall
      : copy.fields.corner;

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

      <div className="simulation-dimension-guide">
        <img
          alt={copy.guideImageAlt}
          onError={props.onGuideImageError}
          src={props.guideImageUrl}
        />
      </div>

      <form className="simulation-dimension-form" onSubmit={onSubmit} noValidate>
        {props.geometryMode === "back_wall" ? (
          <>
            <DimensionField
              id="dim-wall-width"
              label={(fields as typeof copy.fields.backWall).wallWidth}
              onChange={(v) => setField("wallWidth", v)}
              value={values.wallWidth}
            />
            <DimensionField
              id="dim-wall-height"
              label={(fields as typeof copy.fields.backWall).wallHeight}
              onChange={(v) => setField("wallHeight", v)}
              value={values.wallHeight}
            />
            <DimensionField
              id="dim-room-depth"
              label={(fields as typeof copy.fields.backWall).roomDepth}
              onChange={(v) => setField("roomDepth", v)}
              value={values.roomDepth}
            />
          </>
        ) : (
          <>
            <DimensionField
              id="dim-left-wall"
              label={(fields as typeof copy.fields.corner).leftWallWidth}
              onChange={(v) => setField("leftWallWidth", v)}
              value={values.leftWallWidth}
            />
            <DimensionField
              id="dim-right-wall"
              label={(fields as typeof copy.fields.corner).rightWallWidth}
              onChange={(v) => setField("rightWallWidth", v)}
              value={values.rightWallWidth}
            />
            <DimensionField
              id="dim-room-height"
              label={(fields as typeof copy.fields.corner).roomHeight}
              onChange={(v) => setField("roomHeight", v)}
              value={values.roomHeight}
            />
            <DimensionField
              id="dim-room-depth"
              label={(fields as typeof copy.fields.corner).roomDepth}
              onChange={(v) => setField("roomDepth", v)}
              value={values.roomDepth}
            />
          </>
        )}

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
    <label className="simulation-dimension-field" htmlFor={props.id}>
      <span>{props.label}</span>
      <span className="simulation-dimension-input-wrapper">
        <input
          id={props.id}
          inputMode="decimal"
          max={SIMULATION_DIMENSION_MAX_M}
          min={SIMULATION_DIMENSION_MIN_M}
          onChange={(event) => props.onChange(event.target.value)}
          step="0.01"
          type="number"
          value={props.value}
        />
        <span aria-hidden="true">{copy.fieldUnitSuffix}</span>
      </span>
    </label>
  );
}

function isPositiveBounded(raw: string): boolean {
  if (raw.trim() === "") return false;
  const value = Number(raw);
  if (!Number.isFinite(value)) return false;
  return value >= SIMULATION_DIMENSION_MIN_M && value <= SIMULATION_DIMENSION_MAX_M;
}

function toBackWallBody(values: FormValues): BackWallSuppliedDimensions {
  return {
    wall_width: Number(values.wallWidth),
    wall_height: Number(values.wallHeight),
    room_depth: Number(values.roomDepth)
  };
}

function toCornerBody(values: FormValues): CornerSuppliedDimensions {
  return {
    left_wall_width: Number(values.leftWallWidth),
    right_wall_width: Number(values.rightWallWidth),
    room_height: Number(values.roomHeight),
    room_depth: Number(values.roomDepth)
  };
}

async function defaultSubmit(
  jobId: string,
  body: SuppliedDimensionsBody
): Promise<SubmitOutcome> {
  try {
    const response = await fetch(
      `/api/public/simulations/${encodeURIComponent(jobId)}/dimensions`,
      {
        body: JSON.stringify(body),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
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
      message: payload?.error?.message
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
