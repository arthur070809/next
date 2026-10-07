import { forbidden, redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { getFaceEnrollmentFrameCount, isFaceBlinkRequired, isFaceEnrollmentConsentRequired } from "@/lib/facial/config";
import FaceEnrollmentManager from "./FaceEnrollmentManager";

export default async function FaceEnrollmentPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login/admin");
  if (funcionario.role !== "admin") forbidden();
  return <FaceEnrollmentManager
    diagnosticsEnabled={process.env.FACE_DIAGNOSTICS_ENABLED === "true"}
    frameCount={getFaceEnrollmentFrameCount()}
    requireConsent={isFaceEnrollmentConsentRequired()}
    requireBlink={isFaceBlinkRequired()}
  />;
}