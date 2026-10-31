/** Read an installed dictionary entry, never an inherited member. Null denotes
 * absence; own values (including false/zero/undefined) are returned unchanged.
 * Record dictionaries validate non-null records at their contract boundary.
 */
export const own = (object, key) => object != null && Object.hasOwn(object, key) ? object[key] : null;
