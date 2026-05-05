# PLAN-0025 Public Home Page

Plan: PLAN-0025
Spec: SPEC-0012
Status: done
Owner area: web
Depends on: SPEC-0004, SPEC-0010, SPEC-0012, PLAN-0024
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Replace the repository foundation placeholder at `/` with the MVP public home
page for the MÖBEL UNIQUE visualization tool.

The page must create desire to simulate a sofa at home through a landscape
iPhone-style video hero, explain the AI-assisted process, direct visitors
toward `/catalog`, and introduce a reusable minimal public shell without
pulling in the full catalog or simulation wizard.

## Concrete Test Path

After implementation, a public visitor should be able to:

1. Open `/`.
2. See a visible hero statement:
   `In-home simulation, in-home sofa simulation with AI`.
3. Understand the four-step flow:
   - choose a sofa;
   - choose a fabric and visual position;
   - upload a room photo;
   - receive an AI-generated visualization.
4. See the hero video inside a landscape iPhone-style frame.
5. See the hero video play forward and backward in a smooth repeated
   ping-pong loop.
6. Use a primary CTA below the video pointing to `/catalog`.
7. See reassurance that ordering happens on Shopify.
8. See a concise AI limitation message.
9. See visual material that communicates sofa/interior or before-after
   visualization intent.
10. Confirm the page does not expose debug environment values, admin links, cart,
   checkout, account login, price, stock, or service/API configuration.
11. Confirm the layout is usable at mobile and desktop widths.

## Scope

### Home Page `/`

Update `apps/web/src/app/page.tsx` from the foundation placeholder to the public
home page.

Required content:

- visible MÖBEL UNIQUE brand signal;
- visible hero statement exactly or near-exactly matching
  `In-home simulation, in-home sofa simulation with AI`;
- primary CTA below the hero video linking to `/catalog`, with French CTA copy
  inviting the visitor to choose a sofa and simulate it at home;
- secondary supporting action or contextual link only if it reinforces the
  simulation path without competing with the CTA;
- concise process explanation with the four required steps;
- statement that ordering happens on Shopify;
- concise AI limitation message;
- landscape phone-frame video hero using the user-provided video asset.

Most public explanatory copy must remain French. The visible English hero
statement above is an intentional product copy exception requested for this
home hero. If strict French-only public copy is required before implementation,
this line must be translated or covered by a spec change request.

### Public Shell Foundation

Create or inline a minimal public shell suitable for `/`, and reusable by later
public catalog/detail pages.

Shell requirements:

- minimal header/brand presence;
- no admin link;
- no cart, checkout, account, price, or stock navigation;
- footer with minimal non-legal links or placeholder structure only where
  needed by the public page;
- responsive layout that starts from mobile and expands cleanly.

If a reusable component is introduced, keep it local to `apps/web/src/app` or
`apps/web/src/components` only if the project already has or needs that
component boundary. Do not introduce a shared package abstraction for this
page.

### Hero Video Direction

The home page must use the user-provided hero video as the first-viewport
visual asset, not only text and CSS decoration.

Source and output rules:

- the source video will be provided by the user under `apps/web/public`;
- the current detected source file is `apps/web/public/0429.mov`;
- preferred source path for implementation is
  `apps/web/public/videos/home-hero-source.<ext>`;
- the source video is 16:9 landscape, so the phone mockup must also be
  landscape, not portrait;
- before using the asset in the page, compress and adapt it for web delivery;
- produce optimized browser assets under `apps/web/public/videos`, such as:
  - `home-hero-pingpong.webm`;
  - `home-hero-pingpong.mp4`;
  - `home-hero-poster.jpg` or `.png`;
- avoid committing an oversized raw source video unless the user explicitly
  wants the source stored in git.

Playback rules:

- the displayed video must play from beginning to end, then from end to
  beginning, repeatedly;
- the preferred implementation is to pre-render an optimized ping-pong video
  asset by concatenating the forward video and its reversed version, then loop
  the resulting asset;
- avoid relying on unsupported negative video playback rates in browsers;
- the video should autoplay muted, loop, and use `playsInline`;
- provide a poster image so the hero does not appear blank before playback;
- respect reduced-motion preferences by showing the poster or a paused first
  frame when appropriate.

Phone-frame rules:

- render the video inside a landscape iPhone-style frame;
- the phone frame must feel like a device mockup without using a portrait
  aspect ratio;
- the frame must not crop important 16:9 content;
- the frame and video must remain fully visible and non-overlapping on mobile
  and desktop.

Rules:

- do not use real customer room photos;
- do not use private catalog assets;
- do not depend on admin-managed content;
- do not use stock-like dark blurred imagery that hides the actual subject.

### SEO And Metadata

The home page should remain indexable.

Add or update metadata for:

- page title;
- description;
- video poster alt/supporting accessible text where applicable;
- no private URLs, signed URLs, emails, or environment data.

### Styling

Update `apps/web/src/app/globals.css` or a page-local styling approach
consistent with the existing app.

Rules:

- mobile first;
- avoid one-note palettes and heavy ecommerce styling;
- no nested cards or decorative gradient orbs;
- text must fit on mobile and desktop;
- CTA touch targets must be comfortable;
- animations, if any, must respect reduced-motion preferences.
- the landscape phone mockup must keep a stable aspect ratio and must not create
  layout shift while the video loads.

## Out Of Scope

This plan does not include:

- `/catalog` page implementation;
- `/sofas/[slug]` page implementation;
- public catalog card rendering;
- catalog API changes;
- simulation wizard routes;
- email verification;
- visitor room photo upload;
- simulation worker behavior;
- analytics integration;
- cookie or legal consent banner behavior;
- final legal/privacy copy;
- Shopify theme changes;
- admin publication workflows.

The primary CTA may point to `/catalog` even if the full catalog page is
implemented in the next plan. The implementation must not add fake catalog data
or fake simulation behavior to compensate.

## Page Structure

Recommended structure:

1. Header:
   - brand text;
   - primary catalog link.
2. Hero:
   - visible statement: `In-home simulation, in-home sofa simulation with AI`;
   - short French supporting copy explaining AI-assisted visualization;
   - landscape iPhone-style video frame;
   - primary CTA below the video to `/catalog`;
   - reassurance that ordering happens on Shopify.
3. Visual proof section:
   - use the hero video as the primary proof;
   - optional compact supporting copy in French below or near the frame.
4. Process section:
   - four compact steps matching `SPEC-0012`;
   - no excessive instructional copy.
5. AI limitation and privacy-oriented note:
   - AI output is an estimate;
   - final measurements/order verification happen outside the simulation.
6. Footer:
   - minimal brand/footer structure;
   - no fake legal links unless real destinations exist.

## File Structure

Expected implementation files:

- Modify: `apps/web/src/app/page.tsx`;
- Modify: `apps/web/src/app/page.test.tsx`;
- Modify: `apps/web/src/app/globals.css`;
- Add compressed video assets under `apps/web/public/videos` once the user
  provides the source video;
- Add a poster image under `apps/web/public/videos` or
  `apps/web/public/images`;
- Optionally create: public shell component files under `apps/web/src/app` or
  `apps/web/src/components` if reuse is clearer than inline markup.

## Tasks

- [x] Add failing home page tests for hero copy, French supporting content,
      process steps, catalog CTA, Shopify reassurance, AI limitation copy, and
      removal of debug foundation environment output.
- [x] Add failing home page tests for the visible English hero statement,
      landscape phone-frame video, `playsInline`, muted autoplay/loop behavior,
      poster asset, and CTA placement below the video.
- [x] Add failing tests proving the page does not expose admin/ecommerce
      surfaces such as admin links, cart, checkout, account, price, or stock.
- [x] Add the user-provided source video under `apps/web/public/videos` or
      confirm the exact source path if already present.
- [x] Compress and adapt the source into optimized web video assets and a poster
      image.
- [x] Build the ping-pong playback asset or equivalent robust forward/backward
      playback implementation.
- [x] Implement the public home page content and shell.
- [x] Implement the landscape iPhone-style video frame.
- [x] Implement responsive styling for mobile and desktop.
- [x] Add or update metadata for the public home route.
- [x] Run targeted web tests and typecheck.
- [x] Run visual/manual QA at mobile and desktop widths.
- [x] Update relevant roadmaps.
- [x] Run the broader verification gate.
- [x] Move this plan to `docs/plans/done` when verified.

## Tests

Add or update:

- `apps/web/src/app/page.test.tsx`.

Add or document a video processing command once the source file is available,
for example an `ffmpeg` command or a checked script if the process needs to be
repeatable.

Expected automated checks:

- `pnpm --filter @mobel-unique/web test`;
- `pnpm --filter @mobel-unique/web typecheck`;
- `pnpm spec:check`;
- `pnpm test`;
- `pnpm typecheck`;
- `pnpm build`.

Manual/visual verification:

- start `pnpm dev:web`;
- inspect `/` at approximately 320px, 768px, and desktop widths;
- verify no text overlap, clipped CTA labels, inaccessible contrast, or broken
  images;
- verify the landscape video is compressed, loads in the iPhone-style frame,
  does not crop important 16:9 content, and loops forward/backward;
- verify reduced-motion mode does not force unnecessary motion;
- verify the CTA `href` is `/catalog`.

## Roadmap

Update on completion:

- `docs/roadmap/web.md`;
- `docs/roadmap/workflow.md` only if new smoke or visual QA workflow scripts
  are added.

## Notes

The current page exposed local environment and API placeholders. This plan
removed those from public UI.

The user-provided source video is present at `apps/web/public/0429.mov`. The
raw source remains untracked and should not be committed unless explicitly
requested.

Generated optimized assets:

- `apps/web/public/videos/home-hero-pingpong.webm`;
- `apps/web/public/videos/home-hero-pingpong.mp4`;
- `apps/web/public/videos/home-hero-poster.jpg`.

Video processing commands used:

```bash
ffmpeg -y -ss 0.3 -i apps/web/public/0429.mov -vf scale=1280:-2 -frames:v 1 -q:v 3 apps/web/public/videos/home-hero-poster.jpg
ffmpeg -y -i apps/web/public/0429.mov -filter_complex "[0:v]scale=1280:-2,fps=30,format=yuv420p,split[vf][vr];[vr]reverse[rv];[vf][rv]concat=n=2:v=1:a=0[v]" -map "[v]" -an -c:v libx264 -preset medium -crf 25 -movflags +faststart apps/web/public/videos/home-hero-pingpong.mp4
ffmpeg -y -i apps/web/public/0429.mov -filter_complex "[0:v]scale=1280:-2,fps=30,format=yuv420p,split[vf][vr];[vr]reverse[rv];[vf][rv]concat=n=2:v=1:a=0[v]" -map "[v]" -an -c:v libvpx-vp9 -b:v 0 -crf 36 -deadline good -row-mt 1 apps/web/public/videos/home-hero-pingpong.webm
```

Visual QA was performed against the running local dev server at
`http://127.0.0.1:3000` with Chrome headless captures at 390px mobile via CDP,
500px narrow viewport, and 1440px desktop.

The page can be visually polished, but the first deliverable is still a public
MVP entry point. Keep the home page focused on the simulation path rather than
building a marketing site, ecommerce storefront, or full catalog experience.
