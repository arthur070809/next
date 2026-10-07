import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FaceEnrollmentManager from "./FaceEnrollmentManager";

describe("automatic facial enrollment UI", () => {
  it("offers automatic capture without a manual capture or gallery control", () => {
    const markup = renderToStaticMarkup(<FaceEnrollmentManager />);

    expect(markup).toContain("Iniciar câmera");
    expect(markup).not.toContain("Capturar foto");
    expect(markup).not.toContain("Escolher foto frontal");
    expect(markup).not.toContain('type="file"');
    expect(markup).toContain("acontecem automaticamente");
  });
});
