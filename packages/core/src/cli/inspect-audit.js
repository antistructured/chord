#!/usr/bin/env bun
import { createChord } from "../sdk/chord.js";

const chord = createChord();
console.log(JSON.stringify(chord.inspectAudit({ limit: 100 }), null, 2));
