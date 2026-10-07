"use client";

import { useRouter } from "next/navigation";
import { ErrorState } from "./ui";

export function RefreshErrorState({ message }: { message: string }) {
  const router = useRouter();
  return <ErrorState message={message} onRetry={() => router.refresh()} />;
}
