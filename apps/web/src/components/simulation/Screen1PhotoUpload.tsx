"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import {
  compressRoomPhoto,
  type CompressedPhoto
} from "../../lib/simulation-client/compress";
import {
  uploadRoomPhoto,
  type UploadInput,
  type UploadResult
} from "../../lib/simulation-client/upload";
import type { RoomGeometryMode } from "../../lib/simulation-public-api";
import { SimulationContextStrip } from "./SimulationContextStrip";

const SIMULATIONS_ENDPOINT = "/api/public/simulations";

export interface Screen1PhotoUploadProps {
  sofaSlug: string;
  sofaName: string;
  fabricId: string;
  fabricName: string;
  visualPositionId: string;
  visualPositionLabel: string;
  geometryMode: RoomGeometryMode;
  accessToken: string;
  backToSofaHref: string;
  onJobCreated: (jobId: string) => void;
  compress?: (file: File) => Promise<CompressedPhoto>;
  upload?: (input: UploadInput) => Promise<UploadResult>;
  generateIdempotencyKey?: () => string;
  isTouchDevice?: () => boolean;
}

type Phase = "idle" | "uploading" | "failed";

export function Screen1PhotoUpload(props: Screen1PhotoUploadProps) {
  const compress = props.compress ?? compressRoomPhoto;
  const upload = props.upload ?? uploadRoomPhoto;
  const generateIdempotencyKey =
    props.generateIdempotencyKey ?? defaultIdempotencyKeyGenerator;
  const detectTouch = props.isTouchDevice ?? defaultIsTouchDevice;

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<number>(0);

  const isTouch = useMemo(() => detectTouch(), [detectTouch]);
  const copy = SIMULATION_LOCALE.screen1PhotoUpload;

  useEffect(() => {
    if (!pickedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pickedFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pickedFile]);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    setPickedFile(file);
    setIdempotencyKey(generateIdempotencyKey());
    setPhase("idle");
    setProgress(0);
  }

  function clearSelection() {
    setPickedFile(null);
    setIdempotencyKey(null);
    setPhase("idle");
    setProgress(0);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit(): Promise<void> {
    if (!pickedFile || !idempotencyKey) return;
    setPhase("uploading");
    setProgress(0);
    let compressed: CompressedPhoto;
    try {
      compressed = await compress(pickedFile);
    } catch {
      setPhase("failed");
      return;
    }
    const result = await upload({
      endpoint: SIMULATIONS_ENDPOINT,
      sofaSlug: props.sofaSlug,
      fabricId: props.fabricId,
      visualPositionId: props.visualPositionId,
      photoBlob: compressed.blob,
      photoFilename: pickedFile.name,
      idempotencyKey,
      accessToken: props.accessToken,
      onProgress: (percent) => setProgress(percent)
    });
    if (result.ok) {
      props.onJobCreated(result.jobId);
      return;
    }
    setPhase("failed");
  }

  if (phase === "failed") {
    return (
      <section
        aria-live="assertive"
        className="public-status-panel simulation-photo-upload-failed"
      >
        <p className="public-eyebrow">{copy.eyebrow}</p>
        <h2>{copy.uploadFailedTitle}</h2>
        <p>{copy.uploadFailedInstruction}</p>
        <div className="simulation-photo-upload-actions">
          <button
            className="public-primary-button"
            onClick={() => void submit()}
            type="button"
          >
            {copy.uploadFailedRetryButton}
          </button>
          <a className="public-secondary-link" href={props.backToSofaHref}>
            {SIMULATION_LOCALE.shared.backLinkLabel}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="simulation-photo-upload">
      <SimulationContextStrip
        sofaName={props.sofaName}
        fabricName={props.fabricName}
        visualPositionLabel={props.visualPositionLabel}
      />

      <header className="simulation-photo-upload-heading">
        <p className="public-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>
          {props.geometryMode === "corner"
            ? copy.instructionCorner
            : copy.instructionBackWall}
        </p>
      </header>

      {props.geometryMode === "corner" ? (
        <p className="simulation-photo-upload-disclaimer" role="note">
          {copy.disclaimerCornerStrong}
        </p>
      ) : (
        <p className="simulation-photo-upload-disclaimer" role="note">
          {copy.disclaimerBackWallShort}
        </p>
      )}

      <div className="simulation-photo-upload-pickers">
        {isTouch ? (
          <>
            <label className="public-primary-button" htmlFor="simulation-camera-input">
              {copy.takePhotoButton}
            </label>
            <input
              accept="image/*"
              capture="environment"
              data-testid="simulation-camera-input"
              hidden
              id="simulation-camera-input"
              onChange={(event) => chooseFile(event.target.files?.[0])}
              ref={cameraInputRef}
              type="file"
            />
          </>
        ) : null}
        <label className="public-secondary-button" htmlFor="simulation-file-input">
          {copy.chooseFileButton}
        </label>
        <input
          accept="image/*"
          data-testid="simulation-file-input"
          hidden
          id="simulation-file-input"
          onChange={(event) => chooseFile(event.target.files?.[0])}
          ref={fileInputRef}
          type="file"
        />
      </div>

      {previewUrl ? (
        <div className="simulation-photo-upload-preview">
          <img alt={copy.previewAlt} src={previewUrl} />
          <button
            className="public-secondary-button"
            disabled={phase === "uploading"}
            onClick={clearSelection}
            type="button"
          >
            {copy.replaceLink}
          </button>
        </div>
      ) : null}

      {phase === "uploading" ? (
        <p
          aria-live="polite"
          className="simulation-photo-upload-progress"
        >
          {copy.uploadProgressLabel} — {progress}%
        </p>
      ) : null}

      <div className="simulation-photo-upload-actions">
        <button
          className="public-primary-button"
          disabled={!pickedFile || phase === "uploading"}
          onClick={() => void submit()}
          type="button"
        >
          {copy.continueButton}
        </button>
      </div>
    </section>
  );
}

function defaultIdempotencyKeyGenerator(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultIsTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
  );
}
