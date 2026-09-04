export type SchemaV4Transaction = {
  createdAt?: string;
  occurredAt?: string;
  occurredAtEstimated?: boolean;
  status?: string;
};

export function migrateToSchemaV4<T extends { schemaVersion?: number; transactions?: SchemaV4Transaction[] }>(
  raw: T,
): Omit<T, 'schemaVersion'> & { schemaVersion: 4 } {
  if (Number(raw.schemaVersion) >= 4) {
    return { ...raw, schemaVersion: 4 };
  }
  const transactions = (raw.transactions ?? []).map((item) => {
    if (item.occurredAt) {
      return { ...item, status: item.status || 'confirmed' };
    }
    return {
      ...item,
      occurredAt: item.createdAt,
      occurredAtEstimated: Boolean(item.createdAt),
      status: item.status || 'confirmed',
    };
  });
  return { ...raw, schemaVersion: 4, transactions };
}

export const SCHEMA_V3_BACKUP_KEY = 'self-agent:schema-v3-backup';

export type SchemaMigrationBackup = {
  fromVersion: number;
  toVersion: 4;
  checksum: string;
  payload: unknown;
};

export function snapshotChecksum(value: unknown): string {
  const text = JSON.stringify(value) || '';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createSchemaV4MigrationBackup<T extends { schemaVersion?: number }>(
  raw: T,
  existingBackup?: SchemaMigrationBackup | null,
): SchemaMigrationBackup | null {
  if (existingBackup?.checksum) return existingBackup;
  if (Number(raw.schemaVersion) >= 4) return null;
  return {
    fromVersion: Number(raw.schemaVersion ?? 0),
    toVersion: 4,
    checksum: snapshotChecksum(raw),
    payload: JSON.parse(JSON.stringify(raw)) as unknown,
  };
}
