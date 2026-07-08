export type CheckinItemInput = { quantity: number; unitCost: number };

/** Total de un check-in: suma de quantity × unit_cost de sus ítems. */
export function calculateCheckinTotal(items: CheckinItemInput[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
}
