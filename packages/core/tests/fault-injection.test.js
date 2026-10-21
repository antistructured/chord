import { describe, test, expect } from "bun:test";
import { reduceTrace, replayNoSideEffects, diffTraces } from "../src/platform/trace-reducer.js";
import { appendRegistryEvent } from "../src/platform/event-journal.js";
import { createRegistry } from "../src/registry/registry.js";
import { createChord } from "../src/index.js";

describe("Block 4 fault injection", () => {
  test("replay without genesis explicitly rejects insufficient history", () => {
    expect(() => replayNoSideEffects([])).toThrow(/UNSUPPORTED_HISTORY/);
  });

  test("duplicate event id rejected", () => {
    const ev = createChord().inspectEvents()[0];
    expect(() => reduceTrace([ev, { ...ev }])).toThrow(/INVALID_SEMANTICS/);
  });

  test("backwards revision rejected", () => {
    const chord = createChord(); chord.pauseForApproval(); chord.cancelRun();
    const events = chord.inspectEvents(); events.at(-1).run_revision = 0;
    expect(() => reduceTrace(events)).toThrow(/STALE_REVISION/);
  });

  test("diff traces detects divergence", () => {
    const a = [{ event_id: "e1" }, { event_id: "e2" }];
    const b = [{ event_id: "e2" }, { event_id: "e3" }];
    const d = diffTraces(a,b);
    expect(d.missingInB).toContain("e1");
    expect(d.missingInA).toContain("e3");
    expect(d.equal).toBe(false);
  });

  test("event journal includes extended fields", () => {
    const reg = createRegistry();
    reg.run.correlation_id = "corr-1";
    reg.authority = { authority_revision: 3 };
    const ev = appendRegistryEvent(reg, "test_type", { x: 1 }, { correlation_id: "corr-1" });
    expect(ev.run_id).toBe(reg.run.run_id);
    expect(ev.run_revision).toBe(reg.run.revision);
    expect(ev.correlation_id).toBe("corr-1");
    expect(ev.authority_revision).toBe(3);
  });
});
