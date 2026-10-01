export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

/** Builds the standard pagination metadata returned by list endpoints. */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/** Wraps a page of rows into `{ items, meta }`. */
export function paginate<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return { items, meta: buildPaginationMeta(total, page, limit) };
}
