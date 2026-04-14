export async function readText(pathOrUrl) {
  if (typeof Bun !== "undefined" && Bun.file) {
    return await Bun.file(pathOrUrl).text();
  }
  const { readFile } = await import("node:fs/promises");
  return await readFile(pathOrUrl, "utf8");
}

export async function writeText(pathOrUrl, content) {
  if (typeof Bun !== "undefined" && Bun.write) {
    return await Bun.write(pathOrUrl, content);
  }
  const { writeFile } = await import("node:fs/promises");
  return await writeFile(pathOrUrl, content, "utf8");
}
