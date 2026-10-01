const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the value looks like a UUID (so it can safely hit a uuid column). */
export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}
