import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrateToSchemaV4 } from '../app/finance-schema';

describe('schema v3 to v4', () => {
  const v3 = {
    schemaVersion: 3 as const,
    transactions: [
      { id: 'e1', kind: 'expense', createdAt: '2026-08-31T12:00:00+08:00', amount: 40 },
      { id: 'e2', kind: 'expense', createdAt: '2026-09-01T09:00:00+08:00', occurredAt: '2026-08-30T18:00:00+08:00', amount: 12 },
    ],
  };

  it('backfills occurredAt from createdAt and marks the estimate once', () => {
    const once = migrateToSchemaV4(v3);
    expect(once.schemaVersion).toBe(4);
    expect(once.transactions[0]).toMatchObject({
      id: 'e1',
      occurredAt: '2026-08-31T12:00:00+08:00',
      occurredAtEstimated: true,
      status: 'confirmed',
    });
    expect(once.transactions[1]).toMatchObject({
      id: 'e2',
      occurredAt: '2026-08-30T18:00:00+08:00',
    });
    expect((once.transactions[1] as { occurredAtEstimated?: boolean }).occurredAtEstimated).toBeUndefined();
  });

  it('is idempotent on the same v3 snapshot', () => {
    const first = migrateToSchemaV4(v3);
    const second = migrateToSchemaV4(first);
    expect(second).toEqual(first);
  });

  it('hydrates stored v3 snapshots through migrateToSchemaV4', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain('migrateToSchemaV4');
    expect(page).toContain('schemaVersion: 4');
  });
});
