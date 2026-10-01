/** Turn a human name into a URL slug: "Summer T-Shirt!" → "summer-t-shirt". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a unique slug from a base string using the provided uniqueness
 * check (e.g. `prisma.category.findUnique({ where: { slug } })`).
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const candidate = slugify(base) || 'item';

  if (!(await exists(candidate))) {
    return candidate;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const next = `${candidate}-${suffix}`;
    if (!(await exists(next))) {
      return next;
    }
  }

  throw new Error(`Could not generate a unique slug for "${base}"`);
}
