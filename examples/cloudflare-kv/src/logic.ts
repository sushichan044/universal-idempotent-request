type PaymentEvent =
  | {
      amount: number;
      timestamp: Date;
      type: "deposit";
    }
  | {
      amount: number;
      timestamp: Date;
      type: "withdraw";
    };

export interface PaymentStorage {
  deposit(accountId: string, amount: number): Promise<void>;
  getCurrentBalance(accountId: string): Promise<number>;
  withdraw(accountId: string, amount: number): Promise<void>;
}

const calculateBalance = (events: PaymentEvent[]) => {
  return events.reduce((accumulator, event) => {
    return (
      accumulator + (event.type === "deposit" ? event.amount : -event.amount)
    );
  }, 0);
};

export const createPaymentStorage = (kv: KVNamespace): PaymentStorage => {
  return {
    deposit: async (accountId, amount) => {
      const events = (await kv.get<PaymentEvent[]>(accountId, "json")) ?? [];
      events.push({ amount, timestamp: new Date(), type: "deposit" });
      await kv.put(accountId, JSON.stringify(events));
    },
    getCurrentBalance: async (accountId) => {
      const events = (await kv.get<PaymentEvent[]>(accountId, "json")) ?? [];
      return calculateBalance(events);
    },

    withdraw: async (accountId, amount) => {
      const events = (await kv.get<PaymentEvent[]>(accountId, "json")) ?? [];

      const balance = calculateBalance(events);

      if (balance < amount) {
        throw new Error("Insufficient balance");
      }

      events.push({ amount, timestamp: new Date(), type: "withdraw" });
      await kv.put(accountId, JSON.stringify(events));
    },
  };
};
