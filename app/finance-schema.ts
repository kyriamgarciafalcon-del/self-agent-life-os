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
