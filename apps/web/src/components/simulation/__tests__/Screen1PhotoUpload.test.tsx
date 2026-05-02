import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi
} from "vitest";

import { Screen1PhotoUpload } from "../Screen1PhotoUpload";
import type { UploadInput, UploadResult } from "../../../lib/simulation-client/upload";

let createdObjectUrls: string[] = [];
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  URL.createObjectURL = (() => {
    const url = `blob:fake-${createdObjectUrls.length}`;
    createdObjectUrls.push(url);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
});

afterEach(() => {
  cleanup();
  createdObjectUrls = [];
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

const baseProps = {
  sofaSlug: "canape-rivoli",
  sofaName: "Canapé Rivoli",
  fabricId: "fabric-boucle",
  fabricName: "Bouclette écrue",
  visualPositionId: "front",
  visualPositionLabel: "Vue de face",
  accessToken: "dev-token-abc",
  backToSofaHref: "/sofas/canape-rivoli",
  onJobCreated: vi.fn()
};

function fakeJpeg(name = "room.jpg", size = 1024): File {
  return new File([new ArrayBuffer(size)], name, { type: "image/jpeg" });
}

function makePassthroughCompress() {
  return vi.fn(async (file: File) => ({
    blob: file,
    mimeType: file.type,
    width: 1600,
    height: 1200,
    sourceUsed: "compressed" as const
  }));
}

function makeImmediateUploadOk() {
  return vi.fn<(input: UploadInput) => Promise<UploadResult>>(async () => ({
    ok: true,
    jobId: "sim-1",
    status: "queued",
    createdAt: "2026-05-02T10:00:00.000Z",
    retentionDeadline: "2026-05-03T10:00:00.000Z",
    attempts: 1
  }));
}

function makeImmediateUploadNetworkFailure() {
  return vi.fn<(input: UploadInput) => Promise<UploadResult>>(async () => ({
    ok: false,
    code: "NETWORK",
    attempts: 3
  }));
}

describe("Screen1PhotoUpload", () => {
  it("renders the context strip with the sofa, fabric, and visual position", () => {
    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    expect(
      screen.getByLabelText("Contexte de la simulation")
    ).toHaveTextContent("Canapé Rivoli · Bouclette écrue · Vue de face");
  });

  it("shows the corner disclaimer when the sofa geometry mode is corner", () => {
    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="corner"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    expect(
      screen.getByText(
        /coin de la pièce — deux murs qui se rencontrent/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/prise de vue frontale d'un mur/i)
    ).not.toBeInTheDocument();
  });

  it("shows the back-wall disclaimer when the sofa geometry mode is back_wall", () => {
    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    expect(
      screen.getByText(/prise de vue frontale d'un mur/i)
    ).toBeInTheDocument();
  });

  it("renders the camera capture input only on touch devices", () => {
    const { unmount } = render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => true}
      />
    );
    expect(screen.getByTestId("simulation-camera-input")).toHaveAttribute(
      "capture",
      "environment"
    );
    expect(screen.getByTestId("simulation-file-input")).not.toHaveAttribute(
      "capture"
    );
    unmount();

    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );
    expect(
      screen.queryByTestId("simulation-camera-input")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("simulation-file-input")).toBeInTheDocument();
  });

  it("disables the Continue button until a file is selected and shows a preview after selection", () => {
    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    const continueButton = screen.getByRole("button", { name: /continuer/i });
    expect(continueButton).toBeDisabled();
    expect(screen.queryByAltText(/Aperçu de la photo/)).not.toBeInTheDocument();

    const fileInput = screen.getByTestId(
      "simulation-file-input"
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [fakeJpeg()] } });

    expect(continueButton).not.toBeDisabled();
    expect(screen.getByAltText(/Aperçu de la photo/)).toBeInTheDocument();
  });

  it("submits the photo through compress and upload, then notifies the parent with the new job id", async () => {
    const compress = makePassthroughCompress();
    const upload = makeImmediateUploadOk();
    const onJobCreated = vi.fn();

    render(
      <Screen1PhotoUpload
        {...baseProps}
        onJobCreated={onJobCreated}
        geometryMode="back_wall"
        compress={compress}
        upload={upload}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    const file = fakeJpeg();
    fireEvent.change(screen.getByTestId("simulation-file-input"), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));

    await screen.findByText(/sim-1|envoi/i, undefined, { timeout: 1000 }).catch(
      () => undefined
    );
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(compress).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0].sofaSlug).toBe("canape-rivoli");
    expect(upload.mock.calls[0][0].fabricId).toBe("fabric-boucle");
    expect(upload.mock.calls[0][0].visualPositionId).toBe("front");
    expect(upload.mock.calls[0][0].idempotencyKey).toBe("idem-1");
    expect(onJobCreated).toHaveBeenCalledWith("sim-1");
  });

  it("shows the honest retry-after-failure screen and reuses the same Idempotency-Key on Try again", async () => {
    const compress = makePassthroughCompress();
    const upload = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        code: "NETWORK",
        attempts: 3
      })
      .mockResolvedValueOnce({
        ok: true,
        jobId: "sim-2",
        status: "queued",
        createdAt: "x",
        retentionDeadline: "y",
        attempts: 1
      });
    const onJobCreated = vi.fn();
    const generateIdempotencyKey = vi
      .fn()
      .mockReturnValueOnce("idem-stable");

    render(
      <Screen1PhotoUpload
        {...baseProps}
        onJobCreated={onJobCreated}
        geometryMode="back_wall"
        compress={compress}
        upload={upload}
        generateIdempotencyKey={generateIdempotencyKey}
        isTouchDevice={() => false}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-file-input"), {
      target: { files: [fakeJpeg()] }
    });
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));

    const retryButton = await screen.findByRole("button", {
      name: /réessayer l'envoi/i
    });
    expect(
      screen.getByText(/L'envoi n'a pas pu aboutir/i)
    ).toBeInTheDocument();

    fireEvent.click(retryButton);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(generateIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0][0].idempotencyKey).toBe("idem-stable");
    expect(upload.mock.calls[1][0].idempotencyKey).toBe("idem-stable");
    expect(onJobCreated).toHaveBeenCalledWith("sim-2");
  });

  it("falls back to the network failure screen when the upload helper rejects with NETWORK", async () => {
    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadNetworkFailure()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-file-input"), {
      target: { files: [fakeJpeg()] }
    });
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));

    expect(
      await screen.findByText(/L'envoi n'a pas pu aboutir/i)
    ).toBeInTheDocument();
  });
});
