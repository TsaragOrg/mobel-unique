export const FABRIC_RENDER_PROMPT_VERSION = "v007";
export const FABRIC_RENDER_PROMPT_NOTE_HEADER =
  "ADDITIONAL IMPORTANT NOTE FROM THIS RUN:";

export type FabricRenderPromptInput = {
  generationMode?: "initial" | "refine";
  targetWidthPx?: number;
  targetHeightPx?: number;
  promptNote?: string | null;
};

export type FabricRenderRefinePromptInput = {
  refinePrompt: string;
};

const FABRIC_RENDER_V007_BASE_PROMPT = `
You are performing a controlled upholstery material transfer on a locked target
photo.

INPUT IMAGE 1 = FABRIC SOURCE ONLY.
This image may contain a sofa, folds, cushions, seams, buttons, stitching,
tufting, wrinkles, shadows, highlights, compression marks, creases, geometry,
camera perspective, and room context. Ignore all of that.

Use image 1 only as a flat material reference. Extract only:
- base fabric color
- weave and fiber texture
- material grain
- printed or woven pattern, if any
- approximate pattern scale
- surface finish
- softness/material feel

Do not extract or copy any physical form from image 1. Do not copy any folds,
wrinkles, cushion shapes, seam positions, buttons, tufting, stitch lines,
indentations, sagging, bulges, shadows caused by folds, highlights caused by
folds, object contours, sofa geometry, camera angle, or room elements from image
1.

INPUT IMAGE 2 = LOCKED TARGET PHOTO.
This is the photo that must remain visually fixed. Treat image 2 as the base
photo to edit in place. The output must keep the same camera view and
composition as image 2.

Preserve the target sofa exactly:
- exact outer silhouette
- exact frame and proportions
- exact armrests
- exact backrest
- exact seat height
- exact cushion count
- exact cushion size, shape, seams, folds, wrinkles, and spacing
- exact target-sofa seam positions and stitch lines
- exact target-sofa buttons or decorative details, if present
- exact legs, base, and visible construction details

Preserve the camera and composition exactly:
- exact camera angle and viewpoint
- exact camera height
- exact camera position and distance from the sofa
- exact apparent lens/focal length and perspective compression
- exact vanishing points and floor/wall perspective lines
- exact zoom level and crop
- exact framing and object scale
- exact sofa bounding box location inside the image
- exact amount of visible front, side, top, arms, cushions, floor, wall, rug,
  and background
- exact position of background objects relative to the sofa
- exact room, lighting, shadows, and reflections

Pay special attention to rounded and soft geometry. Preserve every curve,
radius, rounded corner, bevel, bulge, pillow-like edge, soft seam transition,
curved armrest edge, rounded cushion corner, sag, crease, fold, and softened
fabric contour from image 2. Do not straighten, square off, flatten, sharpen, or
geometrically simplify any rounded part of the target sofa. The fabric change
must wrap naturally over the existing curved surfaces from image 2 without
changing their shape.

Task:
Generate a photorealistic result showing the exact same photo as image 2, from
the exact same camera view, with the exact same sofa model, but with the visible
upholstery material replaced by the fabric material from image 1.

This is not a sofa redesign. This is not a new sofa generation. This is not a
new camera view. This is not a different crop. This is not a transfer of folds
or physical details from image 1. This is only an in-place replacement of the
visible upholstery material on the target sofa.

Hard constraints:
- Do not change the model of the target sofa.
- Do not change the target sofa silhouette.
- Do not change the target sofa geometry.
- Do not change the target sofa proportions.
- Do not change the number, size, shape, or position of cushions.
- Do not change the armrests, backrest, legs, base, seams, folds, wrinkles, or
  edges from image 2.
- Do not import folds, wrinkles, creases, indentations, shadows, highlights,
  buttons, tufting, stitching, seam layout, cushion contours, sagging, or bulges
  from image 1.
- Do not place fabric-source folds or fabric-source shadows onto the target
  sofa.
- Do not turn rounded corners into square corners.
- Do not turn soft curved edges into straight edges.
- Do not make soft cushions look blocky, boxy, flat, rigid, or angular.
- Do not reduce, sharpen, or alter the radius of any rounded edge.
- Do not simplify curved seams, curved folds, bulges, or cushion contours from
  image 2.
- Do not change the camera viewpoint.
- Do not change the camera angle.
- Do not change the camera height.
- Do not change the camera distance.
- Do not change the lens feel, perspective, vanishing points, or floor/wall
  perspective lines.
- Do not change the zoom, crop, framing, object scale, or composition.
- Do not make the sofa appear closer, farther, larger, smaller, higher, lower,
  more centered, less centered, or differently rotated.
- Do not reveal more or less of the sofa, floor, wall, rug, room, or background
  than in image 2.
- Do not shift background objects or alter their positions relative to the sofa.
- Do not add options, modules, pillows, blankets, decorations, labels, logos,
  text, watermarks, or new objects.
- Do not copy the sofa shape, cushion layout, room, angle, camera setup, crop,
  or styling from image 1.
- Do not replace the target sofa with the sofa from image 1.

If there is any conflict between fabric accuracy and preserving the target
photo, camera setup, target sofa, rounded geometry, or target-sofa folds,
preserve image 2. A result is unacceptable if it contains folds, buttons,
tufting, seams, shadows, highlights, relief, cushion contours, or physical
details copied from image 1.

Return one generated image only.
`;

export function buildFabricRenderPrompt(
  input: FabricRenderPromptInput = {},
): string {
  const basePrompt = FABRIC_RENDER_V007_BASE_PROMPT.trim();
  const note = input.promptNote?.trim();

  if (!note) {
    return basePrompt;
  }

  return [basePrompt, FABRIC_RENDER_PROMPT_NOTE_HEADER, note].join("\n\n");
}

export function buildFabricRenderRefinePrompt(
  input: FabricRenderRefinePromptInput,
): string {
  const refinePrompt = input.refinePrompt.trim();
  if (!refinePrompt) {
    throw new Error("refine prompt is required");
  }

  return [
    "You are refining one existing generated product sofa output image.",
    "Image 1 is the current output to edit.",
    "Apply only the administrator refine instruction to the current output.",
    "Preserve the same sofa identity, camera view, composition, canvas, and product-photo style unless the instruction explicitly asks for a visible detail change.",
    "Return one generated image only.",
    "",
    "Administrator refine instruction:",
    refinePrompt,
  ].join("\n");
}
