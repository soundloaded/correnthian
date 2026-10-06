/**
 * Building `before` and `after` from two versions of a row.
 *
 * The reason this exists rather than a hand-written pair of objects: a caller
 * who assembles them by hand writes `{ enabled: true }` as `before` and then
 * forgets `after`, or copies the whole row into both and stores a hundred
 * unchanged columns on every state change. Both produce an audit entry that
 * looks complete and answers nothing. Here the only decision a caller makes is
 * *which two rows* — what actually changed is derived.
 */

export interface StateChange {
  /** Null when the operation created the resource. */
  before: Record<string, unknown> | null;
  /** Null when the operation deleted it. */
  after: Record<string, unknown> | null;
  /** Field names that differ. Sorted, so two runs over the same pair agree. */
  changed: string[];
}

export interface DiffOptions {
  /**
   * Restrict the diff to these fields. Optional — without it the diff is
   * already "what changed", but a caller that only means to move one column
   * can say so and be sure nothing else leaks into the trail.
   */
  fields?: string[];
}

/**
 * Normalise a value to something comparable and storable as JSON.
 *
 * Prisma returns `Date`, `bigint` and `Decimal`, none of which survive
 * `JSON.stringify` usefully — a Date becomes a string by accident, a bigint
 * throws. Normalising first means a diff of two rows that differ only in their
 * timestamps reports *no* change, rather than a spurious one.
 */
function normalise(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (value === null) return null;

  if (Array.isArray(value)) return value.map(normalise);

  if (typeof value === 'object') {
    // Prisma.Decimal exposes toJSON; a plain snapshot does not.
    const maybeDecimal = value as { toJSON?: () => unknown; constructor?: { name?: string } };
    if (typeof maybeDecimal.toJSON === 'function' && maybeDecimal.constructor?.name === 'Decimal') {
      return String(maybeDecimal.toJSON());
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalise(nested);
    }
    return out;
  }

  return value;
}

/**
 * Key order must not decide whether two snapshots differ — a Prisma `select`
 * in a different order would otherwise read as a change on every call.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('An audit snapshot must be a row-like object, not a primitive or array');
  }
  return normalise(value) as Record<string, unknown>;
}

/**
 * Compare two versions of a row.
 *
 * Both sides are trimmed to the fields that actually differ, so an entry reads
 * as a change rather than as a copy of the resource.
 */
export function diffState(
  before: unknown,
  after: unknown,
  options: DiffOptions = {},
): StateChange {
  const b = asRecord(before);
  const a = asRecord(after);

  if (!b && !a) return { before: null, after: null, changed: [] };
  if (!b) {
    return { before: null, after: a, changed: Object.keys(a ?? {}).sort() };
  }
  if (!a) {
    return { before: b, after: null, changed: Object.keys(b).sort() };
  }

  const candidates = options.fields?.length
    ? options.fields
    : [...new Set([...Object.keys(b), ...Object.keys(a)])];

  const beforeOut: Record<string, unknown> = {};
  const afterOut: Record<string, unknown> = {};
  const changed: string[] = [];

  for (const key of [...candidates].sort()) {
    if (stableStringify(b[key]) === stableStringify(a[key])) continue;
    changed.push(key);
    beforeOut[key] = b[key] ?? null;
    afterOut[key] = a[key] ?? null;
  }

  // An empty pair is worse than no pair: it reads as "something changed" with
  // nothing to see. Callers that hit this are updating a row without a
  // meaningful state change, and should not be writing an audit entry.
  return { before: changed.length ? beforeOut : null, after: changed.length ? afterOut : null, changed };
}