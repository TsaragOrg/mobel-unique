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
const ROOM_PHOTO_ACCEPT = "image/*,.heic,.heif";

export interface Screen1PhotoUploadProps {
  sofaSlug: string;
  sofaName: string;
  fabricId: string;
  fabricName: string;
  visualPositionId: string;
  visualPositionLabel: string;
  geometryMode: RoomGeometryMode;
  accessToken?: string;
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
  const prepareRequestRef = useRef(0);

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [preparedPhoto, setPreparedPhoto] = useState<CompressedPhoto | null>(
    null
  );
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  const isTouch = useMemo(() => detectTouch(), [detectTouch]);
  const copy = SIMULATION_LOCALE.screen1PhotoUpload;

  useEffect(() => {
    if (!previewBlob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewBlob);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewBlob]);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    const requestId = prepareRequestRef.current + 1;
    prepareRequestRef.current = requestId;
    setPickedFile(file);
    setPreparedPhoto(null);
    setPreviewBlob(null);
    setIdempotencyKey(generateIdempotencyKey());
    setPhase("idle");
    setFailureDetail(null);
    setIsPreparingPhoto(true);
    setProgress(0);
    void prepareSelectedPhoto(file, requestId);
  }

  function clearSelection() {
    prepareRequestRef.current += 1;
    setPickedFile(null);
    setPreparedPhoto(null);
    setPreviewBlob(null);
    setIdempotencyKey(null);
    setPhase("idle");
    setFailureDetail(null);
    setIsPreparingPhoto(false);
    setProgress(0);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function prepareSelectedPhoto(
    file: File,
    requestId: number
  ): Promise<void> {
    try {
      const compressed = await compress(file);
      if (prepareRequestRef.current !== requestId) return;
      setPreparedPhoto(compressed);
      setPreviewBlob(
        isPreviewablePhotoMime(compressed.mimeType || compressed.blob.type)
          ? compressed.blob
          : null
      );
    } catch (error) {
      if (prepareRequestRef.current !== requestId) return;
      console.error("[simulations] room photo preparation failed:", {
        error,
        filename: file.name,
        size: file.size,
        type: file.type || "<unknown>"
      });
      setFailureDetail(formatPreparationFailureDetail(error));
      setPhase("failed");
    } finally {
      if (prepareRequestRef.current === requestId) {
        setIsPreparingPhoto(false);
      }
    }
  }

  async function submit(): Promise<void> {
    if (!pickedFile || !idempotencyKey || !preparedPhoto) return;
    setPhase("uploading");
    setFailureDetail(null);
    setProgress(0);
    let result: UploadResult;
    try {
      result = await upload({
        endpoint: SIMULATIONS_ENDPOINT,
        sofaSlug: props.sofaSlug,
        fabricId: props.fabricId,
        visualPositionId: props.visualPositionId,
        photoBlob: preparedPhoto.blob,
        photoFilename: uploadFilenameForPreparedPhoto(
          pickedFile.name,
          preparedPhoto.mimeType
        ),
        idempotencyKey,
        accessToken: props.accessToken,
        onProgress: (percent) => setProgress(percent)
      });
    } catch (error) {
      console.error("[simulations] room photo upload threw:", {
        error,
        filename: pickedFile.name,
        preparedMimeType: preparedPhoto.mimeType,
        preparedSourceUsed: preparedPhoto.sourceUsed,
        preparedSize: preparedPhoto.blob.size
      });
      setFailureDetail(formatThrownFailureDetail(error));
      setPhase("failed");
      return;
    }
    if (result.ok) {
      props.onJobCreated(result.jobId);
      return;
    }
    console.error("[simulations] room photo upload failed:", {
      attempts: result.attempts,
      code: result.code,
      filename: pickedFile.name,
      httpStatus: result.httpStatus,
      message: result.message,
      preparedMimeType: preparedPhoto.mimeType,
      preparedSourceUsed: preparedPhoto.sourceUsed,
      preparedSize: preparedPhoto.blob.size
    });
    setFailureDetail(formatUploadFailureDetail(result));
    setPhase("failed");
  }

  function retryAfterFailure(): void {
    setFailureDetail(null);
    if (pickedFile && !preparedPhoto) {
      const requestId = prepareRequestRef.current + 1;
      prepareRequestRef.current = requestId;
      setPhase("idle");
      setIsPreparingPhoto(true);
      void prepareSelectedPhoto(pickedFile, requestId);
      return;
    }
    void submit();
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
        {failureDetail ? (
          <p className="simulation-photo-upload-diagnostic">{failureDetail}</p>
        ) : null}
        <div className="simulation-photo-upload-actions">
          <button
            className="public-primary-button"
            onClick={retryAfterFailure}
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
              accept={ROOM_PHOTO_ACCEPT}
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
          accept={ROOM_PHOTO_ACCEPT}
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

      {pickedFile && preparedPhoto && !previewUrl ? (
        <div className="simulation-photo-upload-preview">
          <div className="simulation-photo-upload-preview-placeholder">
            <p>{copy.previewUnavailableTitle}</p>
            <span>{pickedFile.name}</span>
          </div>
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

      {isPreparingPhoto ? (
        <p
          aria-live="polite"
          className="simulation-photo-upload-progress"
        >
          {copy.photoPreparationLabel}
        </p>
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
          disabled={
            !pickedFile ||
            !preparedPhoto ||
            isPreparingPhoto ||
            phase === "uploading"
          }
          onClick={() => void submit()}
          type="button"
        >
          {copy.continueButton}
        </button>
      </div>
    </section>
  );
}

function isPreviewablePhotoMime(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  return (
    normalized === "image/jpeg" ||
    normalized === "image/jpg" ||
    normalized === "image/png" ||
    normalized === "image/webp"
  );
}

function uploadFilenameForPreparedPhoto(
  originalFilename: string,
  mimeType: string
): string {
  if (mimeType.toLowerCase() !== "image/jpeg") {
    return originalFilename;
  }
  return originalFilename.replace(/\.[^.]+$/, "") + ".jpg";
}

function formatPreparationFailureDetail(error: unknown): string {
  return `Préparation locale échouée: ${formatUnknownError(error)}`;
}

function formatThrownFailureDetail(error: unknown): string {
  return `Erreur inattendue pendant l'envoi: ${formatUnknownError(error)}`;
}

function formatUploadFailureDetail(result: Extract<UploadResult, { ok: false }>): string {
  const parts = [`Code: ${result.code}`];
  if (typeof result.httpStatus === "number") {
    parts.push(`HTTP ${result.httpStatus}`);
  }
  if (result.message) {
    parts.push(result.message);
  }
  parts.push(`${result.attempts} tentative${result.attempts > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
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
