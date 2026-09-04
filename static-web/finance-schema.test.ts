import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrateToSchemaV4, createSchemaV4MigrationBackup, applySchemaV4Migration } from '../app/finance-schema';

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
    expect(page).toContain('createSchemaV4MigrationBackup');
    expect(page).toContain('SCHEMA_V3_BACKUP_KEY');
    expect(page).toContain('applySchemaV4Migration');
    expect(page).toContain('schemaFrozen');
  });
});

describe('schema v4 pre-migration backup', () => {
  const v3 = {
    schemaVersion: 3 as const,
    transactions: [{ id: 'e1', createdAt: '2026-08-31T12:00:00+08:00', amount: 40 }],
  };

  it('freezes the v3 snapshot with a checksum before upgrade', () => {
    const backup = createSchemaV4MigrationBackup(v3, null);
    expect(backup?.fromVersion).toBe(3);
    expect(backup?.toVersion).toBe(4);
    expect(backup?.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(backup?.payload).toEqual(v3);
    expect(backup?.payload).not.toBe(v3);
  });

  it('does not overwrite an existing backup or snapshot already on v4', () => {
    const first = createSchemaV4MigrationBackup(v3, null)!;
    const mutated = { ...v3, transactions: [] };
    expect(createSchemaV4MigrationBackup(mutated, first)).toEqual(first);
    expect(createSchemaV4MigrationBackup({ schemaVersion: 4, transactions: [] }, null)).toBeNull();
  });
});

describe('schema v4 rollback', () => {
  const v3 = {
    schemaVersion: 3 as const,
    transactions: [{ id: 'e1', createdAt: '2026-08-31T12:00:00+08:00', amount: 40 }],
  };

  it('keeps a valid upgrade persistable', () => {
    const backup = createSchemaV4MigrationBackup(v3, null);
    const result = applySchemaV4Migration(v3, backup);
    expect(result.persist).toBe(true);
    expect(result.data).toMatchObject({ schemaVersion: 4 });
  });

  it('restores the checksummed backup and refuses to persist when occurredAt cannot be recovered', () => {
    const broken = { schemaVersion: 3 as const, transactions: [{ id: 'gap' }] };
    const backup = createSchemaV4MigrationBackup(v3, null);
    const result = applySchemaV4Migration(broken, backup);
    expect(result.persist).toBe(false);
    expect(result.data).toEqual(v3);
    expect(result.reason).toBe('occurredAt');
  });

  it('does not restore a backup whose checksum no longer matches', () => {
    const backup = createSchemaV4MigrationBackup(v3, null)!;
    const tampered = { ...backup, payload: { schemaVersion: 3, transactions: [] } };
    const broken = { schemaVersion: 3 as const, transactions: [{ id: 'gap' }] };
    const result = applySchemaV4Migration(broken, tampered);
    expect(result.persist).toBe(false);
    expect(result.data).toEqual(broken);
    expect(result.reason).toBe('occurredAt');
  });
});
