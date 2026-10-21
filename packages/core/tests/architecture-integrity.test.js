import { test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

test('ARCH-18: first-party JS/ESM kernel has only SigilJS runtime dependency and no provider/framework imports', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  expect(manifest.type).toBe('module'); expect(manifest.dependencies).toEqual({ '@weipertda/sigiljs': '0.18.0' });
  const base = fileURLToPath(new URL('../src/', import.meta.url));
  for (const path of readdirSync(base, { recursive: true }).filter(p => extname(p))) {
    expect(extname(path)).toBe('.js'); const source = readFileSync(join(base, path), 'utf8');
    const imports = [...source.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const name of imports) expect(name.startsWith('.') || name.startsWith('node:') || name === '@weipertda/sigiljs').toBe(true);
  }
});
