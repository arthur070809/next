import { forbidden, redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import FaceEnrollmentManager from "./FaceEnrollmentManager";

export default async function FaceEnrollmentPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login/admin");
  if (funcionario.role !== "admin") forbidden();
  return <FaceEnrollmentManager diagnosticsEnabled={process.env.FACE_DIAGNOSTICS_ENABLED === "true"} />;
}