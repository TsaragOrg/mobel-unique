export const GEMINI_FABRIC_RENDER_MODEL = "gemini-3-pro-image-preview";

export type GeminiImageInput = {
  dataBase64: string;
  mimeType: string;
};

type GeminiRequestBaseInput = {
  model?: string;
  prompt: string;
  targetWidthPx: number;
  targetHeightPx: number;
};

export type GeminiRequestInput =
  | (GeminiRequestBaseInput & {
      generationMode: "initial";
      fabricReference: GeminiImageInput;
      targetSofa: GeminiImageInput;
    })
  | (GeminiRequestBaseInput & {
      generationMode: "refine";
      refineSource: GeminiImageInput;
    });

export type GeminiGeneratedImage = {
  dataBase64: string;
  mimeType: string;
};

export type GeminiProviderFailure = {
  retryable: boolean;
  message: string;
  status?: number;
};

type GeminiInlineDataPart = {
  inlineData: {
    data: string;
    mimeType: string;
  };
};

type GeminiTextPart = {
  text: string;
};

export type GeminiSupportedAspectRatio =
  | "1:1"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "4:5"
  | "5:4"
  | "9:16"
  | "16:9"
  | "21:9";

export type GeminiGenerateContentRequest = {
  model: string;
  contents: Array<{
    role: "user";
    parts: Array<GeminiInlineDataPart | GeminiTextPart>;
  }>;
  config: {
    imageConfig: {
      aspectRatio: GeminiSupportedAspectRatio;
    };
    responseModalities: string[];
  };
};

export type GeminiRestRequestBody = {
  contents: Array<{
    role: "user";
    parts: Array<
      | {
          inline_data: {
            data: string;
            mime_type: string;
          };
        }
      | GeminiTextPart
    >;
  }>;
  generationConfig: {
    imageConfig: {
      aspectRatio: GeminiSupportedAspectRatio;
    };
    responseModalities: string[];
  };
};

const GEMINI_SUPPORTED_ASPECT_RATIOS = [
  { height: 1, value: "1:1", width: 1 },
  { height: 3, value: "2:3", width: 2 },
  { height: 2, value: "3:2", width: 3 },
  { height: 4, value: "3:4", width: 3 },
  { height: 3, value: "4:3", width: 4 },
  { height: 5, value: "4:5", width: 4 },
  { height: 4, value: "5:4", width: 5 },
  { height: 16, value: "9:16", width: 9 },
  { height: 9, value: "16:9", width: 16 },
  { height: 9, value: "21:9", width: 21 },
] as const satisfies ReadonlyArray<{
  height: number;
  value: GeminiSupportedAspectRatio;
  width: number;
}>;

export class GeminiProviderError extends Error {
  retryable: boolean;
  status?: number;

  constructor(
    message: string,
    options: { retryable: boolean; status?: number },
  ) {
    super(message);
    this.name = "GeminiProviderError";
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

export function buildGeminiGenerateContentRequest(
  input: GeminiRequestInput,
): GeminiGenerateContentRequest {
  const parts =
    input.generationMode === "initial"
      ? buildInitialParts(input)
      : buildRefineParts(input);

  return {
    config: {
      imageConfig: {
        aspectRatio: closestGeminiAspectRatio(
          input.targetWidthPx,
          input.targetHeightPx,
        ),
      },
      responseModalities: ["TEXT", "IMAGE"],
    },
    contents: [
      {
        parts,
        role: "user",
      },
    ],
    model: input.model ?? GEMINI_FABRIC_RENDER_MODEL,
  };
}

export function buildGeminiRestRequestBody(
  request: GeminiGenerateContentRequest,
): GeminiRestRequestBody {
  return {
    contents: request.contents.map((content) => ({
      parts: content.parts.map((part) => {
        if ("inlineData" in part) {
          return {
            inline_data: {
              data: part.inlineData.data,
              mime_type: part.inlineData.mimeType,
            },
          };
        }

        return part;
      }),
      role: content.role,
    })),
    generationConfig: {
      imageConfig: {
        aspectRatio: request.config.imageConfig.aspectRatio,
      },
      responseModalities: request.config.responseModalities,
    },
  };
}

export function closestGeminiAspectRatio(
  widthPx: number,
  heightPx: number,
): GeminiSupportedAspectRatio {
  if (
    !Number.isFinite(widthPx) ||
    !Number.isFinite(heightPx) ||
    widthPx <= 0 ||
    heightPx <= 0
  ) {
    throw new Error("Gemini aspect ratio dimensions must be positive numbers");
  }

  const targetRatio = widthPx / heightPx;
  let best = GEMINI_SUPPORTED_ASPECT_RATIOS[0];
  let bestDistance = Math.abs(best.width / best.height - targetRatio);

  for (const candidate of GEMINI_SUPPORTED_ASPECT_RATIOS.slice(1)) {
    const distance = Math.abs(candidate.width / candidate.height - targetRatio);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best.value;
}

export function extractGeminiImage(response: unknown): GeminiGeneratedImage {
  const candidateParts = readCandidateParts(response);
  for (const part of candidateParts) {
    const inlineData = readInlineData(part);
    if (inlineData?.data) {
      return {
        dataBase64: inlineData.data,
        mimeType: inlineData.mimeType ?? "image/png",
      };
    }
  }

  const outputs = readArray(readObject(response)?.outputs);
  for (const output of outputs) {
    const outputObject = readObject(output);
    if (
      outputObject?.type === "image" &&
      typeof outputObject.data === "string"
    ) {
      return {
        dataBase64: outputObject.data,
        mimeType:
          readString(outputObject.mimeType) ??
          readString(outputObject.mime_type) ??
          "image/png",
      };
    }
  }

  throw new GeminiProviderError("Gemini did not return image data", {
    retryable: false,
  });
}

export function classifyGeminiProviderError(
  error: unknown,
): GeminiProviderFailure {
  const errorObject = readObject(error);
  const status = readStatus(errorObject);
  const message =
    readString(errorObject?.message) ??
    (typeof error === "string" ? error : "Gemini provider error");

  if (error instanceof GeminiProviderError) {
    return {
      message: error.message,
      retryable: error.retryable,
      status: error.status,
    };
  }

  if (
    status === 429 ||
    status === 408 ||
    (status !== undefined && status >= 500)
  ) {
    return {
      message,
      retryable: true,
      status,
    };
  }

  if (status !== undefined && status >= 400) {
    return {
      message,
      retryable: false,
      status,
    };
  }

  if (isTransientRuntimeError(errorObject)) {
    return {
      message,
      retryable: true,
    };
  }

  return {
    message,
    retryable: false,
    status,
  };
}

function toInlineDataPart(input: GeminiImageInput): GeminiInlineDataPart {
  return {
    inlineData: {
      data: input.dataBase64,
      mimeType: input.mimeType,
    },
  };
}

function buildInitialParts(
  input: Extract<GeminiRequestInput, { generationMode: "initial" }>,
): Array<GeminiInlineDataPart | GeminiTextPart> {
  return [
    {
      text: "INPUT IMAGE 1: FABRIC SOURCE. Use only the upholstery material from this image.",
    },
    toInlineDataPart(input.fabricReference),
    {
      text: "INPUT IMAGE 2: TARGET SOFA. Preserve this sofa and scene exactly.",
    },
    toInlineDataPart(input.targetSofa),
    {
      text: input.prompt,
    },
  ];
}

function buildRefineParts(
  input: Extract<GeminiRequestInput, { generationMode: "refine" }>,
): Array<GeminiInlineDataPart | GeminiTextPart> {
  return [
    {
      text: "INPUT IMAGE 1: CURRENT OUTPUT. Refine this existing output image in place.",
    },
    toInlineDataPart(input.refineSource),
    {
      text: input.prompt,
    },
  ];
}

function readCandidateParts(response: unknown): unknown[] {
  const candidates = readArray(readObject(response)?.candidates);
  return candidates.flatMap((candidate) => {
    const content = readObject(readObject(candidate)?.content);
    return readArray(content?.parts);
  });
}

function readInlineData(
  part: unknown,
): { data?: string; mimeType?: string } | null {
  const partObject = readObject(part);
  const inlineData =
    readObject(partObject?.inlineData) ?? readObject(partObject?.inline_data);

  if (!inlineData) {
    return null;
  }

  return {
    data: readString(inlineData.data),
    mimeType:
      readString(inlineData.mimeType) ?? readString(inlineData.mime_type),
  };
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readStatus(
  errorObject: Record<string, unknown> | null,
): number | undefined {
  const status =
    errorObject?.status ?? readObject(errorObject?.response)?.status;
  return typeof status === "number" ? status : undefined;
}

function isTransientRuntimeError(
  errorObject: Record<string, unknown> | null,
): boolean {
  const name = readString(errorObject?.name);
  if (name === "TimeoutError" || name === "AbortError") {
    return true;
  }

  const code =
    readString(errorObject?.code) ??
    readString(readObject(errorObject?.cause)?.code);

  return [
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EAI_AGAIN",
  ].includes(code ?? "");
}
