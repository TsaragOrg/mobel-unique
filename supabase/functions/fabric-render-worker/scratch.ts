import type { FabricRenderGenerationMode } from "./job.ts";

export type ScratchFileSystem = {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  remove(path: string): Promise<void>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  writeTextFile(path: string, text: string): Promise<void>;
};

export type PrepareFabricRenderScratchInput = {
  fs: ScratchFileSystem;
  scratchDir: string;
  generationMode: FabricRenderGenerationMode;
  fabricReferenceBytes: Uint8Array;
  targetSofaBytes: Uint8Array;
  refineSourceBytes?: Uint8Array | null;
};

export type RecordFabricRenderScratchSuccessInput = {
  fs: ScratchFileSystem;
  scratchDir: string;
  outputBytes: Uint8Array;
};

export type RecordFabricRenderScratchFailureInput = {
  fs: ScratchFileSystem;
  scratchDir: string;
  errorMessage: string;
};

export async function prepareFabricRenderScratch(
  input: PrepareFabricRenderScratchInput
): Promise<void> {
  await input.fs.mkdir(input.scratchDir, { recursive: true });
  await clearAttemptOutputs(input.fs, input.scratchDir);

  await input.fs.writeFile(
    scratchPath(input.scratchDir, "fabric_ref.jpg"),
    input.fabricReferenceBytes
  );
  await input.fs.writeFile(
    scratchPath(input.scratchDir, "target_sofa.jpg"),
    input.targetSofaBytes
  );

  if (input.generationMode === "refine") {
    if (!input.refineSourceBytes) {
      throw new Error("refine_source.png is required for refine mode");
    }

    await input.fs.writeFile(
      scratchPath(input.scratchDir, "refine_source.png"),
      input.refineSourceBytes
    );
  }
}

export async function recordFabricRenderScratchSuccess(
  input: RecordFabricRenderScratchSuccessInput
): Promise<void> {
  await safeRemove(input.fs, scratchPath(input.scratchDir, "error.txt"));
  await input.fs.writeFile(
    scratchPath(input.scratchDir, "output.png"),
    input.outputBytes
  );
}

export async function recordFabricRenderScratchFailure(
  input: RecordFabricRenderScratchFailureInput
): Promise<void> {
  await safeRemove(input.fs, scratchPath(input.scratchDir, "output.png"));
  await input.fs.writeTextFile(
    scratchPath(input.scratchDir, "error.txt"),
    input.errorMessage
  );
}

async function clearAttemptOutputs(
  fs: ScratchFileSystem,
  scratchDir: string
): Promise<void> {
  await safeRemove(fs, scratchPath(scratchDir, "output.png"));
  await safeRemove(fs, scratchPath(scratchDir, "error.txt"));
}

async function safeRemove(fs: ScratchFileSystem, path: string): Promise<void> {
  try {
    await fs.remove(path);
  } catch {
    // Missing scratch files are already clean for the next attempt.
  }
}

function scratchPath(scratchDir: string, filename: string): string {
  return `${scratchDir.replace(/\/+$/, "")}/${filename}`;
}
