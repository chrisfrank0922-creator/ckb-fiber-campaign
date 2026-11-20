export function formatCkb(value: bigint | string, maximumFractionDigits?: number) {
  const shannons = typeof value === 'bigint' ? value : BigInt(value);
  const asNumber = Number(shannons) / 100_000_000;
  if (!Number.isFinite(asNumber)) return '—';
  return asNumber.toLocaleString('en-US', {
    maximumFractionDigits: maximumFractionDigits ?? (asNumber > 0 && asNumber < 1 ? 4 : 2),
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  return `${(bytes / 1_024).toFixed(1)} KB`;
}

export function balanceRatio(local: string, remote: string) {
  const total = BigInt(local) + BigInt(remote);
  if (total === 0n) return 0;
  return Math.min(100, Math.max(0, Number((BigInt(local) * 10_000n) / total) / 100));
}

export function padCode(value: string) {
  return value.padEnd(4, '·');
}
