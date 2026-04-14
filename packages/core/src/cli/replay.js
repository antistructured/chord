#!/usr/bin/env bun
import { createChord } from "../sdk/chord.js";
import { parseArgs } from "./_shared.js";

const args = parseArgs(process.argv.slice(2));
const chord = createChord();

if (args["--task"]) {
  console.log(JSON.stringify(chord.replayTask(args["--task"]), null, 2));
} else if (args["--journal"]) {
  console.log(JSON.stringify(chord.replayJournal(), null, 2));
} else {
  console.error("provide --task <id> or --journal");
  process.exitCode = 1;
}
