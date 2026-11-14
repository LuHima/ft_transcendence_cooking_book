export type SeedEnv = 'dev' | 'prod';

const PRODUCTION_TRUE_VALUES = new Set(['true', '1']);
const PRODUCTION_FALSE_VALUES = new Set(['false', '0']);

/**
 * Resolves the database seed environment (`dev` | `prod`).
 *
 * Precedence:
 * 1. Explicit `DB_SEED_ENV` (`dev` or `prod`), failing fast on invalid values.
 * 2. `PRODUCTION_FLAG` (`true`/`1` -> `prod`, `false`/`0`/unset -> `dev`).
 */
export function resolveSeedEnv(env: NodeJS.ProcessEnv = process.env): SeedEnv {
  const explicit = env.DB_SEED_ENV?.trim().toLowerCase();
  if (explicit !== undefined && explicit !== '') {
    if (explicit === 'dev' || explicit === 'prod') {
      return explicit;
    }
    throw new Error(
      `Invalid DB_SEED_ENV="${env.DB_SEED_ENV}". Allowed values are "dev" or "prod".`,
    );
  }

  const prodFlag = env.PRODUCTION_FLAG?.trim().toLowerCase();
  if (prodFlag === undefined || prodFlag === '') {
    return 'dev';
  }
  if (PRODUCTION_TRUE_VALUES.has(prodFlag)) {
    return 'prod';
  }
  if (PRODUCTION_FALSE_VALUES.has(prodFlag)) {
    return 'dev';
  }
  throw new Error(
    `Invalid PRODUCTION_FLAG="${env.PRODUCTION_FLAG}". Expected one of: true, 1, false, 0.`,
  );
}

/**
 * Returns true when an explicit destructive reset is requested via `DB_SEED_RESET`.
 */
export function isSeedResetEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.DB_SEED_RESET?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}
