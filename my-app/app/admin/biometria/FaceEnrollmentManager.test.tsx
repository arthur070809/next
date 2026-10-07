import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FaceEnrollmentManager from "./FaceEnrollmentManager";

describe("automatic facial enrollment UI", () => {
  it("offers an automatic registration flow without confirmation boxes or manual capture by default", () => {
    const markup = renderToStaticMarkup(<FaceEnrollmentManager frameCount={1} />);

    expect(markup).toContain("Iniciar cadastro");
    expect(markup).not.toContain('type="checkbox"');
    expect(markup).not.toContain("Capturar foto");
    expect(markup).not.toContain("Escolher foto frontal");
    expect(markup).not.toContain('type="file"');
    expect(markup).toContain("salvo automaticamente");
    expect(markup).toContain("uma foto ou vídeo pode passar");
  });

  it("shows only the optional privacy checkbox when explicitly enabled", () => {
    const markup = renderToStaticMarkup(<FaceEnrollmentManager requireConsent />);

    expect(markup.match(/type="checkbox"/g)).toHaveLength(1);
    expect(markup).not.toContain("Confirmo que a pessoa diante da câmera");
    expect(markup).toContain("revisado pelo jurídico");
  });
});
