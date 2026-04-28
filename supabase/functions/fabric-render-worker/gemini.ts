export const GEMINI_FABRIC_RENDER_MODEL = "gemini-3-pro-image-preview";

export type GeminiImageInput = {
  dataBase64: string;
  mimeType: string;
};

export type GeminiRequestInput = {
  model?: string;
  fabricReference: GeminiImageInput;
  targetSofa: GeminiImageInput;
  refineSource?: GeminiImageInput | null;
  prompt: string;
};

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

export type GeminiGenerateContentRequest = {
  model: string;
  contents: Array<{
    role: "user";
    parts: Array<GeminiInlineDataPart | GeminiTextPart>;
  }>;
  config: {
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
    responseModalities: string[];
  };
};

export class GeminiProviderError extends Error {
  retryable: boolean;
  status?: number;

  constructor(
    message: string,
    options: { retryable: boolean; status?: number }
  ) {
    super(message);
    this.name = "GeminiProviderError";
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

export function buildGeminiGenerateContentRequest(
  input: GeminiRequestInput
): GeminiGenerateContentRequest {
  const parts: Array<GeminiInlineDataPart | GeminiTextPart> = [
    toInlineDataPart(input.fabricReference),
    toInlineDataPart(input.targetSofa)
  ];

  if (input.refineSource) {
    parts.push(toInlineDataPart(input.refineSource));
  }

  parts.push({
    text: buildLabeledPrompt(input.prompt, Boolean(input.refineSource))
  });

  return {
    config: {
      responseModalities: ["TEXT", "IMAGE"]
    },
    contents: [
      {
        parts,
        role: "user"
      }
    ],
    model: input.model ?? GEMINI_FABRIC_RENDER_MODEL
  };
}

export function buildGeminiRestRequestBody(
  request: GeminiGenerateContentRequest
): GeminiRestRequestBody {
  return {
    contents: request.contents.map((content) => ({
      parts: content.parts.map((part) => {
        if ("inlineData" in part) {
          return {
            inline_data: {
              data: part.inlineData.data,
              mime_type: part.inlineData.mimeType
            }
          };
        }

        return part;
      }),
      role: content.role
    })),
    generationConfig: {
      responseModalities: request.config.responseModalities
    }
  };
}

export function extractGeminiImage(response: unknown): GeminiGeneratedImage {
  const candidateParts = readCandidateParts(response);
  for (const part of candidateParts) {
    const inlineData = readInlineData(part);
    if (inlineData?.data) {
      return {
        dataBase64: inlineData.data,
        mimeType: inlineData.mimeType ?? "image/png"
      };
    }
  }

  const outputs = readArray(readObject(response)?.outputs);
  for (const output of outputs) {
    const outputObject = readObject(output);
    if (outputObject?.type === "image" && typeof outputObject.data === "string") {
      return {
        dataBase64: outputObject.data,
        mimeType:
          readString(outputObject.mimeType) ??
          readString(outputObject.mime_type) ??
          "image/png"
      };
    }
  }

  throw new GeminiProviderError("Gemini did not return image data", {
    retryable: false
  });
}

export function classifyGeminiProviderError(
  error: unknown
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
      status: error.status
    };
  }

  if (status === 429 || status === 408 || (status !== undefined && status >= 500)) {
    return {
      message,
      retryable: true,
      status
    };
  }

  if (status !== undefined && status >= 400) {
    return {
      message,
      retryable: false,
      status
    };
  }

  if (isTransientRuntimeError(errorObject)) {
    return {
      message,
      retryable: true
    };
  }

  return {
    message,
    retryable: false,
    status
  };
}

function toInlineDataPart(input: GeminiImageInput): GeminiInlineDataPart {
  return {
    inlineData: {
      data: input.dataBase64,
      mimeType: input.mimeType
    }
  };
}

function buildLabeledPrompt(prompt: string, hasRefineSource: boolean): string {
  const labels = [
    "Image 1 is the fabric material source. Use it only for material, texture, color, weave, pattern scale, and finish.",
    "Image 2 is the locked target sofa photo. Preserve its geometry, camera view, composition, dimensions, and shape."
  ];

  if (hasRefineSource) {
    labels.push(
      "Image 3 is the refinement source render. Improve it without changing the locked target sofa identity."
    );
  }

  labels.push("Assembled fixed prompt:");
  labels.push(prompt);

  return labels.join("\n");
}

function readCandidateParts(response: unknown): unknown[] {
  const candidates = readArray(readObject(response)?.candidates);
  return candidates.flatMap((candidate) => {
    const content = readObject(readObject(candidate)?.content);
    return readArray(content?.parts);
  });
}

function readInlineData(part: unknown): { data?: string; mimeType?: string } | null {
  const partObject = readObject(part);
  const inlineData =
    readObject(partObject?.inlineData) ?? readObject(partObject?.inline_data);

  if (!inlineData) {
    return null;
  }

  return {
    data: readString(inlineData.data),
    mimeType:
      readString(inlineData.mimeType) ?? readString(inlineData.mime_type)
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
  errorObject: Record<string, unknown> | null
): number | undefined {
  const status = errorObject?.status ?? readObject(errorObject?.response)?.status;
  return typeof status === "number" ? status : undefined;
}

function isTransientRuntimeError(
  errorObject: Record<string, unknown> | null
): boolean {
  const name = readString(errorObject?.name);
  if (name === "TimeoutError" || name === "AbortError") {
    return true;
  }

  const code =
    readString(errorObject?.code) ?? readString(readObject(errorObject?.cause)?.code);

  return [
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EAI_AGAIN"
  ].includes(code ?? "");
}
