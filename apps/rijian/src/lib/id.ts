export function uid(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}
