/**
 * Shared query-parameter transformation and contextual sort_by accessor helpers for DTOs.
 */

export function transformOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}

export function transformOptionalInt({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return typeof value === 'number' ? value : Number(value);
}

/**
 * Creates a WeakMap-backed sort_by accessor pair that falls back to `reportedSortBy`
 * when `reported_only` is true and no explicit override was set.
 */
export function createContextualSortByAccessor<
  T extends { reported_only?: boolean },
  S,
>(defaultSortBy: S, reportedSortBy: S) {
  const overrides = new WeakMap<T, S>();
  return {
    get(instance: T): S {
      const override = overrides.get(instance);
      if (override !== undefined) {
        return override;
      }
      return instance.reported_only ? reportedSortBy : defaultSortBy;
    },
    set(instance: T, value: S | undefined): void {
      if (value === undefined) {
        overrides.delete(instance);
        return;
      }
      overrides.set(instance, value);
    },
  };
}
