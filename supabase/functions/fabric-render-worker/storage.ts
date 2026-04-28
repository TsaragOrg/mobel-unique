type FetchResponseLike = {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
};

type FetchLike = (
  url: string,
  init: {
    body?: Uint8Array;
    headers: Record<string, string>;
    method: string;
  }
) => Promise<FetchResponseLike>;

export type StorageObjectInput = {
  supabaseUrl: string;
  bucketId: string;
  objectPath: string;
};

export type StorageRequestInput = StorageObjectInput & {
  serviceRoleKey: string;
  fetchImpl: FetchLike;
};

export type StorageUploadInput = StorageRequestInput & {
  body: Uint8Array;
  contentType: string;
};

export class StorageObjectError extends Error {
  retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "StorageObjectError";
  }
}

export function buildStorageObjectUrl(input: StorageObjectInput): string {
  const baseUrl = input.supabaseUrl.replace(/\/+$/, "");
  const objectPath = input.objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${baseUrl}/storage/v1/object/${encodeURIComponent(input.bucketId)}/${objectPath}`;
}

export async function downloadStorageObject(
  input: StorageRequestInput
): Promise<Uint8Array> {
  const response = await input.fetchImpl(buildStorageObjectUrl(input), {
    headers: serviceRoleHeaders(input.serviceRoleKey),
    method: "GET"
  });

  if (!response.ok) {
    throw new StorageObjectError(
      `Storage download failed with HTTP ${response.status}: ${await response.text()}`
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function uploadStorageObject(
  input: StorageUploadInput
): Promise<void> {
  const response = await input.fetchImpl(buildStorageObjectUrl(input), {
    body: input.body,
    headers: {
      ...serviceRoleHeaders(input.serviceRoleKey),
      "Content-Type": input.contentType,
      "x-upsert": "true"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new StorageObjectError(
      `Storage upload failed with HTTP ${response.status}: ${await response.text()}`
    );
  }
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.slice(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function base64ToUint8Array(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function serviceRoleHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey
  };
}
