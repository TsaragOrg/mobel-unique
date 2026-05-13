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
const ANGLE_ROOM_GUIDE_FRONT_IMAGE_SRC =
  "/images/simulation/angle-room-guide.webp";
const ANGLE_SOFA_OVERLAY_FRONT_IMAGE_SRC =
  "/images/simulation/angle-sofa-overlay.webp";
const ANGLE_ROOM_GUIDE_CORNER_IMAGE_SRC =
  "/images/simulation/angle-room-guide-corner.webp";
const ANGLE_SOFA_OVERLAY_CORNER_IMAGE_SRC =
  "/images/simulation/angle-sofa-overlay-corner.webp";

export interface Screen1PhotoUploadProps {
  sofaSlug: string;
  sofaName: string;
  fabricId: string;
  fabricName: string;
  visualPositionId: string;
  visualPositionLabel: string;
  geometryMode: RoomGeometryMode;
  sofaPreviewAlt?: string;
  sofaPreviewUrl?: string | null;
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
  const selectedSofaAlt =
    props.sofaPreviewAlt ??
    `${props.sofaName} en ${props.fabricName}, ${props.visualPositionLabel}`;
  const roomPhotoTargetActionLabel = pickedFile
    ? copy.replaceRoomPhotoActionLabel
    : copy.roomPhotoTargetActionLabel;
  const roomPhotoTargetInstruction = isTouch
    ? copy.roomPhotoTargetInstructionTouch
    : copy.roomPhotoTargetInstructionDesktop;
  const isPhotoBusy = isPreparingPhoto || phase === "uploading";
  const photoBusyText =
    phase === "uploading"
      ? `${copy.uploadProgressLabel} — ${progress}%`
      : copy.photoPreparationLabel;
  const roomPhotoTargetClassName = [
    "simulation-photo-upload-room-frame",
    !pickedFile ? "simulation-photo-upload-room-frame-empty" : "",
    previewUrl || (pickedFile && preparedPhoto)
      ? "simulation-photo-upload-room-frame-ready"
      : "",
    phase === "uploading" ? "" : "simulation-photo-upload-room-frame-clickable",
    isPhotoBusy ? "simulation-photo-upload-room-frame-busy" : ""
  ]
    .filter(Boolean)
    .join(" ");

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

  function openPhotoTargetPicker(): void {
    if (phase === "uploading") return;
    const input = isTouch ? cameraInputRef.current : fileInputRef.current;
    if (input) input.value = "";
    input?.click();
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

      <section
        aria-label={copy.guidanceAriaLabel}
        className="simulation-photo-upload-guidance"
      >
        <div className="simulation-photo-upload-guidance-panel">
          <p className="simulation-photo-upload-guidance-label">
            {copy.selectedSofaLabel}
          </p>
          <div className="simulation-photo-upload-sofa-frame">
            {props.sofaPreviewUrl ? (
              <img alt={selectedSofaAlt} src={props.sofaPreviewUrl} />
            ) : (
              <div className="simulation-photo-upload-sofa-unavailable">
                <p>{copy.selectedSofaUnavailableTitle}</p>
                <span>{copy.selectedSofaUnavailableInstruction}</span>
              </div>
            )}
            <span className="simulation-photo-upload-sofa-view-badge">
              <span>{copy.selectedSofaViewBadge}</span>
              <strong>{props.visualPositionLabel}</strong>
            </span>
          </div>
        </div>

        <div className="simulation-photo-upload-guidance-panel">
          <p className="simulation-photo-upload-guidance-label">
            {copy.roomPhotoTargetLabel}
          </p>
          <button
            aria-label={roomPhotoTargetActionLabel}
            className={roomPhotoTargetClassName}
            data-testid="simulation-photo-target"
            disabled={phase === "uploading"}
            onClick={openPhotoTargetPicker}
            type="button"
          >
            {previewUrl ? (
              <img alt={copy.previewAlt} src={previewUrl} />
            ) : null}

            {pickedFile && preparedPhoto && !previewUrl ? (
              <div className="simulation-photo-upload-preview-placeholder">
                <p>{copy.previewUnavailableTitle}</p>
                <span>{pickedFile.name}</span>
              </div>
            ) : null}

            {!pickedFile ? (
              <div className="simulation-photo-upload-room-placeholder">
                <div className="simulation-photo-upload-angle-stage">
                  <div className="simulation-photo-upload-angle-sequence">
                    <div className="simulation-photo-upload-angle-scene simulation-photo-upload-angle-scene-front">
                      <img
                        alt={copy.angleGuideImageAlt}
                        className="simulation-photo-upload-room-guide-image"
                        src={ANGLE_ROOM_GUIDE_FRONT_IMAGE_SRC}
                      />
                      <img
                        alt=""
                        aria-hidden="true"
                        className="simulation-photo-upload-sofa-overlay-image simulation-photo-upload-sofa-overlay-front"
                        src={ANGLE_SOFA_OVERLAY_FRONT_IMAGE_SRC}
                      />
                    </div>
                    <div
                      aria-hidden="true"
                      className="simulation-photo-upload-angle-scene simulation-photo-upload-angle-scene-corner"
                    >
                      <img
                        alt=""
                        className="simulation-photo-upload-room-guide-image"
                        src={ANGLE_ROOM_GUIDE_CORNER_IMAGE_SRC}
                      />
                      <img
                        alt=""
                        className="simulation-photo-upload-sofa-overlay-image simulation-photo-upload-sofa-overlay-corner"
                        src={ANGLE_SOFA_OVERLAY_CORNER_IMAGE_SRC}
                      />
                    </div>
                  </div>
                </div>
                <div className="simulation-photo-upload-room-placeholder-copy">
                  <p className="simulation-photo-upload-angle-message">
                    {copy.angleGuideMessage}
                  </p>
                  <span className="simulation-photo-upload-room-upload-callout">
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 3v11" />
                      <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
                      <path d="M5 14v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4" />
                    </svg>
                    <span>{copy.roomPhotoTargetTitle}</span>
                  </span>
                  <span className="simulation-photo-upload-room-upload-hint">
                    {roomPhotoTargetInstruction}
                  </span>
                </div>
              </div>
            ) : null}

            {pickedFile && preparedPhoto ? (
              <span className="simulation-photo-upload-room-replace-hint">
                {copy.replaceLink}
              </span>
            ) : null}

            {isPhotoBusy ? (
              <span
                aria-label={copy.photoBusyLabel}
                className="simulation-photo-upload-room-busy"
                role="status"
              >
                <span
                  aria-hidden="true"
                  className="simulation-photo-upload-spinner"
                />
                <span>{photoBusyText}</span>
              </span>
            ) : null}
          </button>
        </div>
      </section>

      {props.geometryMode === "corner" ? (
        <p className="simulation-photo-upload-disclaimer" role="note">
          {copy.disclaimerCornerStrong}
        </p>
      ) : null}

      {isTouch ? (
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
      ) : null}
      <input
        accept={ROOM_PHOTO_ACCEPT}
        data-testid="simulation-file-input"
        hidden
        id="simulation-file-input"
        onChange={(event) => chooseFile(event.target.files?.[0])}
        ref={fileInputRef}
        type="file"
      />

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
