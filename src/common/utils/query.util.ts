import { Transform } from 'class-transformer';

/** Convert a URL/query value into a boolean (`?active=false` → false). */
export function parseBooleanQuery(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  return undefined;
}

/** class-validator friendly decorator for `?flag=true|false` query params. */
export function QueryBoolean() {
  return Transform(({ value }) => parseBooleanQuery(value));
}
