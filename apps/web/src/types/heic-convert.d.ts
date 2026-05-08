declare module "heic-convert" {
  export interface HeicConvertOptions {
    buffer: Buffer | Uint8Array | ArrayBuffer;
    format: "JPEG" | "PNG";
    quality?: number;
  }

  export default function convert(
    options: HeicConvertOptions
  ): Promise<Buffer | Uint8Array | ArrayBuffer>;
}
