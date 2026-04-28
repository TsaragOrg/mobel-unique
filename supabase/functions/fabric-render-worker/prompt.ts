export const FABRIC_RENDER_PROMPT_VERSION = "v007";

export type FabricRenderPromptInput = {
  generationMode: "initial" | "refine";
  targetWidthPx: number;
  targetHeightPx: number;
  promptNote?: string | null;
};

export function buildFabricRenderPrompt(input: FabricRenderPromptInput): string {
  const basePrompt = [
    "You are generating one product sofa render for a catalog preparation workflow.",
    `The output image must keep the target sofa dimensions exactly ${input.targetWidthPx}x${input.targetHeightPx} pixels.`,
    "Use the first image only as the fabric material reference.",
    "Use the second image as the locked target sofa photo.",
    "Preserve the target sofa geometry, camera view, composition, folds, seams, cushions, armrests, legs, and overall shape.",
    "Transfer only the fabric material, texture, color, weave, pattern scale, and finish from the fabric reference image.",
    "Do not copy the fabric reference sofa shape, shadows, folds, buttons, background, room context, or camera angle.",
    "Return one generated image only."
  ];

  if (input.generationMode === "refine") {
    basePrompt.push(
      "Use the third image as the render selected for refinement.",
      "Improve the selected refinement image while preserving the locked target sofa geometry, camera view, composition, dimensions, and target fabric identity."
    );
  }

  const note = input.promptNote?.trim();
  if (note) {
    basePrompt.push(
      "Additional administrator instruction appended to the fixed prompt:"
    );
    basePrompt.push(note);
  }

  return basePrompt.join("\n");
}
