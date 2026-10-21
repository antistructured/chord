import { deepClone } from "../utils/clone.js";
import { authorityError } from "./authorization.js";

export const HISTORY_VERSION = "chord.history.v1";
export function canonicalProjection(registry) {
  const { event_journal, ...projection } = registry;
  return deepClone(projection);
}
export function sameData(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameData(a[k], b[k]));
}
export function stateChanges(before, after) {
  const out = [];
  function walk(a, b, path, aExists = true, bExists = true) {
    if (aExists && bExists && sameData(a, b)) return;
    if (aExists && bExists && a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], [...path, key], Object.hasOwn(a, key), Object.hasOwn(b, key));
    } else if (aExists && bExists && Array.isArray(a) && Array.isArray(b) && b.length >= a.length) {
      b.forEach((v, i) => walk(a[i], v, [...path, String(i)], i < a.length, true));
    } else out.push({ path, before: aExists ? { exists: true, value: a } : { exists: false }, after: bExists ? { exists: true, value: b } : { exists: false } });
  }
  walk(before, after, []);
  return deepClone(out);
}
export function applyChanges(state, changes) {
  const next = deepClone(state);
  for (const change of changes) {
    if (!change.path.length || change.path.some(k => ["__proto__", "constructor", "prototype", "event_journal"].includes(k))) throw authorityError("INVALID_HISTORY");
    let target = next;
    for (const key of change.path.slice(0, -1)) {
      if (!target || typeof target !== "object" || !Object.hasOwn(target, key)) throw authorityError("INCOMPLETE_HISTORY");
      target = target[key];
    }
    const key = change.path.at(-1);
    if (!target || typeof target !== "object") throw authorityError("INVALID_HISTORY");
    const exists = Object.hasOwn(target, key);
    if (typeof change.before.exists !== "boolean" || typeof change.after.exists !== "boolean" || exists !== change.before.exists || (exists && !sameData(target[key], change.before.value))) throw authorityError("CONFLICTING_HISTORY");
    if (Array.isArray(target) && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) > target.length || !change.after.exists)) throw authorityError("INVALID_HISTORY");
    if (change.after.exists) target[key] = deepClone(change.after.value);
    else delete target[key];
  }
  return next;
}
