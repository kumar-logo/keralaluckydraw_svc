interface OrderLike {
  amount: number;
  quantity: number;
  totalAmount: number;
}

interface CodeEntry {
  pickAmount: number;
  amount: number;
  pickCount: number;
  count: number;
}

const mapCodeEntry = (order: OrderLike): CodeEntry => {
  const lineAmount = Number(order.totalAmount);
  const quantity = Number(order.quantity);
  const unitAmount = Number(order.amount);
  return {
    pickAmount: unitAmount,
    amount: lineAmount,
    pickCount: quantity,
    count: quantity,
  };
};

const sumAmount = (entries: { amount?: number }[]): number =>
  entries.reduce((total, e) => total + (e.amount || 0), 0);

describe('my-orders line rendering: pickAmount x qty must equal the line total', () => {
  it('slat bet (price 11 x 3): shows 11*3, NOT 33*3', () => {
    const entry = mapCodeEntry({ amount: 11, quantity: 3, totalAmount: 33 });

    expect(entry.pickAmount).toBe(11);
    expect(entry.pickCount).toBe(3);
    expect(entry.pickAmount * entry.pickCount).toBe(33);
    expect(entry.pickAmount * entry.pickCount).not.toBe(99);
  });

  it('plain bet (quantity 1) is unchanged', () => {
    const entry = mapCodeEntry({ amount: 20, quantity: 1, totalAmount: 20 });

    expect(entry.pickAmount).toBe(20);
    expect(entry.pickAmount * entry.pickCount).toBe(20);
  });

  it('the alias `amount` stays the LINE TOTAL so sumAmount keeps working', () => {
    const orders: OrderLike[] = [
      { amount: 11, quantity: 3, totalAmount: 33 },
      { amount: 12, quantity: 2, totalAmount: 24 },
      { amount: 20, quantity: 1, totalAmount: 20 },
    ];
    const entries = orders.map(mapCodeEntry);

    expect(sumAmount(entries)).toBe(77);
    expect(entries.map((e) => e.amount)).toEqual([33, 24, 20]);
  });

  it('every line satisfies pickAmount * pickCount === amount across mixed quantities', () => {
    const orders: OrderLike[] = [
      { amount: 11, quantity: 1, totalAmount: 11 },
      { amount: 11, quantity: 5, totalAmount: 55 },
      { amount: 12, quantity: 10, totalAmount: 120 },
      { amount: 22, quantity: 4, totalAmount: 88 },
      { amount: 0.5, quantity: 4, totalAmount: 2 },
    ];

    for (const order of orders) {
      const entry = mapCodeEntry(order);
      expect(entry.pickAmount * entry.pickCount).toBeCloseTo(entry.amount, 2);
    }
  });

  it('MONEY SAFETY: splitting a folded line into unit+qty leaves the charged total identical', () => {
    const sellingPrice = 11;
    const count = 3;
    const foldedLineTotal = count * sellingPrice;

    const before = { amount: foldedLineTotal, quantity: 1, totalAmount: foldedLineTotal };
    const after = {
      amount: sellingPrice,
      quantity: Math.max(1, count),
      totalAmount: foldedLineTotal,
    };

    expect(after.totalAmount).toBe(before.totalAmount);
    expect(after.amount * after.quantity).toBe(after.totalAmount);

    const e = mapCodeEntry(after);
    expect(e.pickAmount).toBe(11);
    expect(e.pickCount).toBe(3);
    expect(sumAmount([mapCodeEntry(before)])).toBe(sumAmount([e]));
  });

  it('REGRESSION: the old mapping (pickAmount = totalAmount) over-reports whenever qty > 1', () => {
    const order: OrderLike = { amount: 11, quantity: 3, totalAmount: 33 };
    const broken = Number(order.totalAmount) * Number(order.quantity);
    const fixed = mapCodeEntry(order);

    expect(broken).toBe(99);
    expect(fixed.pickAmount * fixed.pickCount).toBe(33);
  });
});
