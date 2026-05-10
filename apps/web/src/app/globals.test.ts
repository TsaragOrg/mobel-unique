import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("global public catalog styles", () => {
  it("keeps desktop catalog filters on one visual line", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
      .replace(/\r\n/g, "\n");

    expect(css).toContain(`.catalog-filters {
  align-items: center;
  border-bottom: 1px solid var(--public-line);
  display: flex;
  flex-wrap: nowrap;`);
    expect(css).toContain(`.catalog-filters .catalog-filter-button,
.catalog-filters .catalog-filter-toggle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`);
    expect(css).not.toContain("border-style: dashed;");
    expect(css).toContain(`.catalog-filter-toggle:hover {
  background: var(--public-ink);
  border-color: var(--public-ink);
  color: #ffffff;
}`);
  });

  it("adapts the filter popup for long mobile labels", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
      .replace(/\r\n/g, "\n");
    const mobileStart = css.indexOf("@media (max-width: 680px)");
    const nextMediaStart = css.indexOf("@media", mobileStart + 1);
    const mobileCss = css.slice(mobileStart, nextMediaStart);

    expect(css).toContain(".catalog-filter-dialog-backdrop");
    expect(css).toContain(".catalog-filter-dialog-list");
    expect(mobileCss).not.toContain("background: var(--public-panel);");
    expect(mobileCss).toContain(`.catalog-filters {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-start;
    overflow: visible;
    padding: 14px clamp(22px, 5vw, 70px) 16px;
  }`);
    expect(mobileCss).toContain(`.catalog-filter-button,
  .catalog-filter-toggle {
    border-radius: 999px;
    flex: 0 1 auto;
    justify-content: center;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    overflow-wrap: normal;
    padding: 9px 15px;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: auto;
  }`);
    expect(mobileCss).toContain(`.catalog-filters .catalog-filter-button {
    flex: 1 1 auto;
    max-width: 100%;
  }`);
    expect(mobileCss).toContain(`.catalog-filters .catalog-filter-toggle {
    flex: 0 0 100%;
    width: 100%;
  }`);
    expect(mobileCss).toContain(`.catalog-filter-dialog-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    padding: 14px;
  }`);
    expect(mobileCss).toContain(`.catalog-filter-dialog-button {
    max-width: 100%;
    justify-content: center;
    width: fit-content;
  }`);
  });

  it("keeps catalog card tags in a compact two-line chip block", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
      .replace(/\r\n/g, "\n");

    expect(css).toContain(`.catalog-card .public-tag-list {
  align-items: flex-start;
  max-height: 66px;
  overflow: hidden;
}`);
    expect(css).toContain(`.catalog-card .public-tag-list li {
  box-sizing: border-box;
  max-width: calc((100% - 8px) / 2);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`);
  });

  it("keeps sofa detail tags as a two-line expandable chip list", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
      .replace(/\r\n/g, "\n");

    expect(css).toContain(`.sofa-tags-panel {
  grid-column: 1 / -1;
  min-width: 0;
}`);
    expect(css).toContain(`.sofa-tag-list {
  align-items: flex-start;
  max-height: 68px;
  overflow: hidden;
}`);
    expect(css).toContain(`.sofa-tag-list-expanded {
  max-height: none;
  overflow: visible;
}`);
    expect(css).toContain(`.sofa-tag-list li {
  box-sizing: border-box;
  max-width: calc((100% - 8px) / 2);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`);
    expect(css).toContain(`.sofa-tag-list .sofa-tag-list-toggle-item {
  display: inline-flex;
  padding: 0;
}`);
  });

  it("keeps public simulation dimension fields discoverable above the fold", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
      .replace(/\r\n/g, "\n");
    const compactDimensionStart = css.indexOf("@media (max-width: 780px)");
    const nextMediaStart = css.indexOf("@media", compactDimensionStart + 1);
    const compactDimensionCss = css.slice(
      compactDimensionStart,
      nextMediaStart,
    );

    expect(css).toContain(`.simulation-dimension-heading h1 {
  color: var(--public-ink);
  font-family:
    "HelveticaNeue-Light", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: clamp(1.75rem, 3vw, 2.35rem);`);
    expect(css).toContain(`grid-template-columns: minmax(0, 1fr) minmax(300px, 420px);`);
    expect(css).toContain(`height: clamp(280px, 42vw, 620px);`);
    expect(css).toContain(`max-height: calc(100vh - 230px);`);
    expect(css).not.toContain(".simulation-dimension-field-red");
    expect(css).not.toContain(".simulation-dimension-field-blue");
    expect(css).not.toContain(".simulation-dimension-field-green");
    expect(compactDimensionCss).toContain(`.simulation-dimension-guide {
    height: clamp(180px, 52vw, 300px);
    max-height: none;
  }`);
  });

  it("keeps public simulation result actions beside a bounded result image", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
      .replace(/\r\n/g, "\n");
    const compactResultStart = css.indexOf("@media (max-width: 780px)");
    const compactResultCss = css.slice(compactResultStart);

    expect(css).toContain(`.simulation-result-workspace {
  align-items: start;
  display: grid;
  gap: clamp(16px, 2.4vw, 32px);
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);`);
    expect(css).toContain(`.simulation-result-image {
  align-items: center;
  background: #f6f6f4;
  border: 1px solid var(--public-line);
  display: flex;
  height: clamp(360px, 52vw, 760px);`);
    expect(css).toContain(`max-height: calc(100vh - 210px);`);
    expect(css).toContain(`.simulation-result-panel {
  align-self: start;
  border-top: 1px solid var(--public-line);
  display: flex;`);
    expect(compactResultCss).toContain(`.simulation-result-image {
    height: clamp(260px, 74vw, 520px);
    max-height: none;
  }`);
  });
});
