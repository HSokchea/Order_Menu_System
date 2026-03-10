import type { StoredOrderItem, OrderRound } from './order';

/**
 * Compute a round-level status from its individual items.
 * Priority: rejected (all) → pending → preparing → ready → completed (mapped from ready when all ready)
 */
export type RoundStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'rejected';

export function computeRoundStatus(items: StoredOrderItem[]): RoundStatus {
  if (items.length === 0) return 'pending';

  const statuses = items.map(i => i.status);
  const allRejected = statuses.every(s => s === 'rejected');
  if (allRejected) return 'rejected';

  const nonRejected = statuses.filter(s => s !== 'rejected');
  const allReady = nonRejected.every(s => s === 'ready');
  if (allReady) return 'ready';

  const hasPreparing = statuses.includes('preparing');
  if (hasPreparing) return 'preparing';

  const hasConfirmed = statuses.includes('confirmed');
  if (hasConfirmed) return 'confirmed';

  const hasPending = statuses.includes('pending');
  if (hasPending) return 'pending';

  return 'pending';
}

/**
 * Compute a global order status from all rounds.
 */
export function computeGlobalStatus(rounds: OrderRound[]): string {
  if (rounds.length === 0) return 'No rounds';

  const roundStatuses = rounds.map(r => computeRoundStatus(r.items));

  if (roundStatuses.every(s => s === 'rejected')) return 'Cancelled';
  if (roundStatuses.every(s => s === 'ready' || s === 'completed' || s === 'rejected')) return 'All Ready';
  if (roundStatuses.some(s => s === 'preparing')) return 'In Progress';
  return 'In Progress';
}
