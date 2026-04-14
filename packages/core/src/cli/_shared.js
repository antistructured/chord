export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const next = argv[i + 1];
      out[arg] = next && !next.startsWith("--") ? next : true;
      if (out[arg] !== true) i += 1;
    } else {
      (out._ ||= []).push(arg);
    }
  }
  return out;
}
