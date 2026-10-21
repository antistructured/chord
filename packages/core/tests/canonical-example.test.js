import { describe, test, expect } from "bun:test";
import { runCanonicalWorkflow } from "../examples/cross-actor-workflow.mjs";

describe("Block 5 canonical workflow", () => {
  test("cross-session workflow with approval and replay", async () => {
    const result = await runCanonicalWorkflow();
    expect(result.actors).toEqual(["builder", "reviewer", "human"]);
    expect(result.accepted_handoff).toBe(true);
    expect(result.approval_required).toBe(true);
    expect(result.approval_validated).toBe(true);
    expect(result.approval_consumed).toBe(true);
    expect(result.snapshot_restored).toBe(true);
    expect(result.final_task_status).toBe("completed");
    expect(result.effect_dispatch_count).toBe(1);
    expect(result.builder_effect_count).toBe(1);
    expect(result.negative_effect_count).toBe(0);
    expect(result.replay_verified).toBe(true);
  });
});
