import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const deploymentId = process.env.VERCEL_GIT_COMMIT_SHA;
  const buildId = deploymentId && /^[a-f\d]{7,40}$/i.test(deploymentId)
    ? deploymentId.slice(0, 8)
    : "local";
  return NextResponse.json({ buildId }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
