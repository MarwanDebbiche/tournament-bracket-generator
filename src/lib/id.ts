/** Generate a collision-resistant unique id, preferring the platform UUID. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old environments.
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
