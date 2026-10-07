import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FaceEnrollmentManager from "./FaceEnrollmentManager";

describe("automatic facial enrollment UI", () => {
  it("opens the camera as the single gesture and removes positioning/test copy", () => {
    const markup = renderToStaticMarkup(<FaceEnrollmentManager frameCount={1} />);

    expect(markup).toContain("Abrir câmera");
    expect(markup).not.toContain("Iniciar cadastro");
    expect(markup).not.toContain('type="checkbox"');
    expect(markup).not.toContain("Capturar foto");
    expect(markup).not.toContain("Escolher foto frontal");
    expect(markup).not.toContain('type="file"');
    expect(markup).not.toContain("Aviso de teste");
    expect(markup).not.toContain("Posicione o rosto");
    expect(markup).toContain("autoPlay");
    expect(markup).toContain("playsInline");
  });

  it("shows only the optional privacy checkbox when explicitly enabled", () => {
    const markup = renderToStaticMarkup(<FaceEnrollmentManager requireConsent />);

    expect(markup.match(/type="checkbox"/g)).toHaveLength(1);
    expect(markup).not.toContain("Confirmo que a pessoa diante da câmera");
    expect(markup).toContain("revisado pelo jurídico");
  });
});
