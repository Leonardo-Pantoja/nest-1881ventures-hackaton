export class PurchaseConfirmation {
  readonly operationId: string;
  private pending: Promise<void> | null = null;
  private completed = false;
  constructor(private readonly persist: (operationId: string) => Promise<void>, id = crypto.randomUUID()) {
    this.operationId = id;
  }
  // Selection and cancellation never call persistence. Only this method does.
  confirm(): Promise<void> {
    if (this.completed) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = Promise.resolve().then(() => this.persist(this.operationId)).then(() => { this.completed = true; });
    void this.pending.catch(() => { this.pending = null; });
    return this.pending;
  }
}

type OperationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function pendingPurchaseOperation(owner: string, name: string, price: number, storage?: OperationStorage) {
  const key = "antesdegastar_purchase_intent_v1:" + JSON.stringify([owner, name, price]);
  let id = crypto.randomUUID() as string;
  try {
    const saved = storage?.getItem(key);
    if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)) id = saved;
    storage?.setItem(key, id);
  } catch { /* Storage restrictions must not trigger an extra write. */ }
  return { id, complete() {
    try { if (storage?.getItem(key) === id) storage.removeItem(key); } catch { /* The receipt still protects this operation. */ }
  } };
}
