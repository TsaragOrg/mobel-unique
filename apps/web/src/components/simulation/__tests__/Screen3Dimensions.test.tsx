import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Screen3Dimensions } from "../Screen3Dimensions";
import type { SuppliedDimensionsBody } from "../../../lib/simulation-public-api";

type SubmitFn = (
  jobId: string,
  body: SuppliedDimensionsBody
) => Promise<{ ok: true } | { ok: false; code?: string; message?: string }>;

afterEach(cleanup);

const baseProps = {
  jobId: "sim-1",
  sofaName: "Canapé Rivoli",
  fabricName: "Bouclette",
  visualPositionLabel: "Vue de face",
  guideImageUrl: "https://signed.example/guide.png",
  onGuideImageError: vi.fn(),
  onSubmitted: vi.fn()
};

function makeOkSubmit() {
  return vi.fn<SubmitFn>(async () => ({ ok: true }));
}

describe("Screen3Dimensions", () => {
  it("renders three numeric fields when the geometry mode is back_wall", () => {
    render(
      <Screen3Dimensions
        {...baseProps}
        geometryMode="back_wall"
        submit={makeOkSubmit()}
      />
    );

    expect(screen.getByLabelText(/Largeur du mur \(rouge\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hauteur du mur \(bleu\)/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Profondeur de la pièce \(vert\)/)
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Mur gauche/)
    ).not.toBeInTheDocument();
  });

  it("renders four numeric fields when the geometry mode is corner", () => {
    render(
      <Screen3Dimensions
        {...baseProps}
        geometryMode="corner"
        submit={makeOkSubmit()}
      />
    );

    expect(screen.getByLabelText(/Mur gauche \(rouge\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mur droit \(rouge\)/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Hauteur de la pièce \(bleu\)/)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Profondeur de la pièce \(vert\)/)
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Largeur du mur/)
    ).not.toBeInTheDocument();
  });

  it("triggers the onGuideImageError callback when the guide image fails to load", () => {
    const onGuideImageError = vi.fn();
    render(
      <Screen3Dimensions
        {...baseProps}
        onGuideImageError={onGuideImageError}
        geometryMode="back_wall"
        submit={makeOkSubmit()}
      />
    );

    const guide = screen.getByAltText(/lignes colorées/i);
    fireEvent.error(guide);

    expect(onGuideImageError).toHaveBeenCalledTimes(1);
  });

  it("disables the Continue button until every field has a positive number under 20", () => {
    render(
      <Screen3Dimensions
        {...baseProps}
        geometryMode="back_wall"
        submit={makeOkSubmit()}
      />
    );

    const continueButton = screen.getByRole("button", { name: /continuer/i });
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Largeur du mur/), {
      target: { value: "4.2" }
    });
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Hauteur du mur/), {
      target: { value: "2.7" }
    });
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Profondeur de la pièce/), {
      target: { value: "5" }
    });
    expect(continueButton).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Profondeur de la pièce/), {
      target: { value: "25" }
    });
    expect(continueButton).toBeDisabled();
  });

  it("posts the back_wall payload shape on submit and notifies the parent", async () => {
    const submit = makeOkSubmit();
    const onSubmitted = vi.fn();
    render(
      <Screen3Dimensions
        {...baseProps}
        onSubmitted={onSubmitted}
        geometryMode="back_wall"
        submit={submit}
      />
    );

    fireEvent.change(screen.getByLabelText(/Largeur du mur/), {
      target: { value: "4.2" }
    });
    fireEvent.change(screen.getByLabelText(/Hauteur du mur/), {
      target: { value: "2.7" }
    });
    fireEvent.change(screen.getByLabelText(/Profondeur de la pièce/), {
      target: { value: "5" }
    });
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toBe("sim-1");
    expect(submit.mock.calls[0]?.[1]).toEqual({
      wall_width: 4.2,
      wall_height: 2.7,
      room_depth: 5
    });
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("posts the corner payload shape on submit", async () => {
    const submit = makeOkSubmit();
    render(
      <Screen3Dimensions
        {...baseProps}
        geometryMode="corner"
        submit={submit}
      />
    );

    fireEvent.change(screen.getByLabelText(/Mur gauche/), {
      target: { value: "3.4" }
    });
    fireEvent.change(screen.getByLabelText(/Mur droit/), {
      target: { value: "4" }
    });
    fireEvent.change(screen.getByLabelText(/Hauteur de la pièce/), {
      target: { value: "2.7" }
    });
    fireEvent.change(screen.getByLabelText(/Profondeur de la pièce/), {
      target: { value: "5" }
    });
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(submit.mock.calls[0]?.[1]).toEqual({
      left_wall_width: 3.4,
      right_wall_width: 4,
      room_height: 2.7,
      room_depth: 5
    });
  });
});
