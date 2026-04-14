#!/usr/bin/env bun
import { createChord } from "../sdk/chord.js";
import { parseArgs } from "./_shared.js";

const args = parseArgs(process.argv.slice(2));
const loop = Boolean(args["--loop"]);
const interval = Number(args["--interval"] || 250);
const chord = createChord();

async function once() {
  const result = await chord.runCycle();
  console.log(JSON.stringify(result, null, 2));
}

if (loop) {
  console.log("starting chord runtime loop...");
  while (true) {
    await once();
    await new Promise(r => setTimeout(r, interval));
  }
} else {
  await once();
}
