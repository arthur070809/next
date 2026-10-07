import { describe, expect, it } from "vitest";
import { StatusRequisicao } from "@/generated/prisma/client";
import { REQUISITION_STATUS_LABELS } from "./requisition-status";

describe("request status labels", () => {
  it("has a Portuguese label for every persisted request status", () => {
    expect(Object.keys(REQUISITION_STATUS_LABELS).sort()).toEqual(
      Object.values(StatusRequisicao).sort(),
    );
    for (const label of Object.values(REQUISITION_STATUS_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});
