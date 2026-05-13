import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
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
import type { CompressedPhoto } from "../../../lib/simulation-client/compress";
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
  vi.useRealTimers();
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

function fakeHeic(name = "room.HEIC", size = 1024): File {
  return new File([new ArrayBuffer(size)], name, {
    type: "application/octet-stream"
  });
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
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

  it("shows the selected sofa and a concise room-photo target before upload", () => {
    const { container } = render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        sofaPreviewAlt="Canapé Rivoli en bouclette écrue, Vue de face"
        sofaPreviewUrl="https://assets.example/rivoli-front-boucle-medium.png"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    expect(
      screen.getByLabelText(/Canapé sélectionné et photo de la pièce/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Canapé Rivoli en bouclette écrue, Vue de face"
      })
    ).toHaveAttribute(
      "src",
      "https://assets.example/rivoli-front-boucle-medium.png"
    );
    expect(
      screen.getByText("Canapé sélectionné", {
        selector: ".simulation-photo-upload-guidance-label"
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Photo à prendre/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Prenez la photo dans le même angle que le canapé/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Photo de votre intérieur/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cliquez ici pour uploader ou prendre une photo/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Angle à reproduire")).toBeInTheDocument();
    expect(screen.queryByText("Repère photo")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Animation montrant le canapé placé/i
      })
    ).toHaveAttribute(
      "src",
      "/images/simulation/angle-room-guide.webp"
    );
    expect(
      container.querySelector(
        'img[src="/images/simulation/angle-sofa-overlay.webp"]'
      )
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        'img[src="/images/simulation/angle-room-guide-corner.webp"]'
      )
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        'img[src="/images/simulation/angle-sofa-overlay-corner.webp"]'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Ajouter une photo de votre pièce"
      })
    ).toBeInTheDocument();
    expect(screen.queryByText("Choisir un fichier")).not.toBeInTheDocument();
    expect(screen.queryByText("Prendre une photo")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Même angle que le canapé")
    ).not.toBeInTheDocument();
  });

  it("keeps the selected side-view label visible before the visitor chooses a photo", () => {
    render(
      <Screen1PhotoUpload
        {...baseProps}
        visualPositionLabel="Vue côté droit"
        geometryMode="back_wall"
        sofaPreviewAlt="Canapé Rivoli en bouclette écrue, Vue côté droit"
        sofaPreviewUrl="https://assets.example/rivoli-right-boucle-medium.png"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    expect(screen.getByText("Angle à reproduire")).toBeInTheDocument();
    expect(screen.getAllByText("Vue côté droit").length).toBeGreaterThan(0);
    expect(screen.queryByText(/ne prenez pas une photo de face du mur/i))
      .not.toBeInTheDocument();
  });

  it("opens the room-photo picker when the room-photo target is clicked", () => {
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

    const fileInput = screen.getByTestId(
      "simulation-file-input"
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ajouter une photo de votre pièce"
      })
    );

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("opens the file picker from the room-photo target on touch devices", () => {
    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={makePassthroughCompress()}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => true}
      />
    );

    const fileInput = screen.getByTestId(
      "simulation-file-input"
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ajouter une photo de votre pièce"
      })
    );

    expect(
      screen.getByText(/Touchez ici pour uploader ou prendre une photo/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("simulation-camera-input")
    ).not.toBeInTheDocument();
    expect(clickSpy).toHaveBeenCalledTimes(1);
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
      screen.getByRole("img", {
        name: /Animation montrant le canapé placé/i
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/prise de vue frontale d'un mur/i)
    ).not.toBeInTheDocument();
  });

  it("does not add a back-wall disclaimer when the sofa geometry mode is back_wall", () => {
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
      screen.queryByText(/L'angle choisi compte autant que la distance/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/prise de vue frontale/i)
    ).not.toBeInTheDocument();
  });

  it("renders a single room-photo input without forced camera capture", () => {
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
    expect(
      screen.queryByTestId("simulation-camera-input")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("simulation-file-input")).toHaveAttribute(
      "accept",
      "image/*,.heic,.heif"
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
    expect(screen.getByTestId("simulation-file-input")).toHaveAttribute(
      "accept",
      "image/*,.heic,.heif"
    );
    expect(screen.getByTestId("simulation-file-input")).not.toHaveAttribute(
      "capture"
    );
  });

  it("disables the Continue button until a file is prepared and shows a preview after selection", async () => {
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

    expect(continueButton).toBeDisabled();
    expect(
      await screen.findByAltText(/Aperçu de la photo/)
    ).toBeInTheDocument();
    await waitFor(() => expect(continueButton).not.toBeDisabled());
  });

  it("shows a loading state inside the room-photo target while preparing the image", async () => {
    const pendingCompress = deferred<CompressedPhoto>();
    const compress = vi.fn(() => pendingCompress.promise);

    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={compress}
        upload={makeImmediateUploadOk()}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-file-input"), {
      target: { files: [fakeJpeg()] }
    });

    expect(
      await screen.findByLabelText("Photo en cours de traitement")
    ).toHaveTextContent("Préparation de la photo");

    pendingCompress.resolve({
      blob: fakeJpeg(),
      mimeType: "image/jpeg",
      width: 1600,
      height: 1200,
      sourceUsed: "compressed" as const
    });
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
    await waitFor(() => expect(compress).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continuer/i })).not.toBeDisabled()
    );
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

  it("uploads the prepared JPEG when a HEIC file is converted for preview", async () => {
    const jpegBlob = new Blob([new ArrayBuffer(512)], { type: "image/jpeg" });
    const compress = vi.fn(async () => ({
      blob: jpegBlob,
      mimeType: "image/jpeg",
      width: 1200,
      height: 900,
      sourceUsed: "compressed" as const
    }));
    const upload = makeImmediateUploadOk();

    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={compress}
        upload={upload}
        generateIdempotencyKey={() => "idem-heic"}
        isTouchDevice={() => false}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-file-input"), {
      target: { files: [fakeHeic()] }
    });
    expect(
      await screen.findByAltText(/Aperçu de la photo/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));

    expect(upload.mock.calls[0][0].photoBlob).toBe(jpegBlob);
    expect(upload.mock.calls[0][0].photoFilename).toBe("room.jpg");
  });

  it("does not block upload when a HEIC file cannot be converted for preview", async () => {
    const heicFile = fakeHeic();
    const compress = vi.fn(async (file: File) => ({
      blob: file,
      mimeType: file.type,
      width: 0,
      height: 0,
      sourceUsed: "original" as const
    }));
    const upload = makeImmediateUploadOk();

    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={compress}
        upload={upload}
        generateIdempotencyKey={() => "idem-heic-original"}
        isTouchDevice={() => false}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-file-input"), {
      target: { files: [heicFile] }
    });
    expect(
      await screen.findByText(/Aperçu indisponible pour ce fichier/i)
    ).toBeInTheDocument();
    expect(screen.queryByAltText(/Aperçu de la photo/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continuer/i })).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));

    expect(upload.mock.calls[0][0].photoBlob).toBe(heicFile);
    expect(upload.mock.calls[0][0].photoFilename).toBe("room.HEIC");
  });

  it("shows the honest retry-after-failure screen and reuses the same Idempotency-Key on Try again", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continuer/i })).not.toBeDisabled()
    );
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
    expect(errorSpy).toHaveBeenCalledWith(
      "[simulations] room photo upload failed:",
      expect.objectContaining({ code: "NETWORK" })
    );
    errorSpy.mockRestore();
  });

  it("falls back to the network failure screen when the upload helper rejects with NETWORK", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continuer/i })).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));

    expect(
      await screen.findByText(/L'envoi n'a pas pu aboutir/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Code: NETWORK/i)).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith(
      "[simulations] room photo upload failed:",
      expect.objectContaining({ code: "NETWORK" })
    );
    errorSpy.mockRestore();
  });

  it("shows server validation diagnostics when the upload API rejects the photo", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const upload = vi.fn<(input: UploadInput) => Promise<UploadResult>>(
      async () => ({
        ok: false,
        code: "VALIDATION_FAILED",
        attempts: 1,
        httpStatus: 400,
        message: "room_photo content-type application/octet-stream is not supported"
      })
    );

    render(
      <Screen1PhotoUpload
        {...baseProps}
        geometryMode="back_wall"
        compress={makePassthroughCompress()}
        upload={upload}
        generateIdempotencyKey={() => "idem-1"}
        isTouchDevice={() => false}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-file-input"), {
      target: { files: [fakeHeic()] }
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continuer/i })).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));

    expect(
      await screen.findByText(/Code: VALIDATION_FAILED · HTTP 400/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/room_photo content-type application\/octet-stream/i)
    ).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith(
      "[simulations] room photo upload failed:",
      expect.objectContaining({
        code: "VALIDATION_FAILED",
        httpStatus: 400
      })
    );
    errorSpy.mockRestore();
  });
});
