interface Preset {
  amount: number;
  mark: string;
  bonusPct: number;
}

const computeRechargeBonus = (amount: number, presets: Preset[]): number => {
  const preset = presets.find((p) => Number(p.amount) === amount);
  if (!preset) return 0;
  const pct = Number(preset.bonusPct);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Number(((amount * pct) / 100).toFixed(2));
};

const PRESETS: Preset[] = [
  { amount: 100, mark: '', bonusPct: 1 },
  { amount: 150, mark: '', bonusPct: 0 },
  { amount: 200, mark: '', bonusPct: 5 },
  { amount: 250, mark: 'Popular', bonusPct: 2.5 },
  { amount: 1000, mark: '', bonusPct: 10 },
];

describe('recharge per-amount bonus', () => {
  it("the owner's example: 100 at 1% credits 1 bonus -> 101 in the wallet", () => {
    const bonus = computeRechargeBonus(100, PRESETS);
    expect(bonus).toBe(1);
    expect(100 + bonus).toBe(101);
  });

  it('each amount carries its OWN percentage, not a common one', () => {
    expect(computeRechargeBonus(200, PRESETS)).toBe(10); // 5%
    expect(computeRechargeBonus(250, PRESETS)).toBe(6.25); // 2.5%
    expect(computeRechargeBonus(1000, PRESETS)).toBe(100); // 10%
  });

  it('accepts DECIMAL percentages (1.5%, 2.5%, 12.75%), not just integers', () => {
    expect(computeRechargeBonus(1000, [{ amount: 1000, mark: '', bonusPct: 1.5 }])).toBe(15);
    expect(computeRechargeBonus(200, [{ amount: 200, mark: '', bonusPct: 2.5 }])).toBe(5);
    expect(computeRechargeBonus(400, [{ amount: 400, mark: '', bonusPct: 12.75 }])).toBe(51);
    expect(computeRechargeBonus(1000, [{ amount: 1000, mark: '', bonusPct: 0.5 }])).toBe(5);
  });

  it('a preset with 0% grants no bonus', () => {
    expect(computeRechargeBonus(150, PRESETS)).toBe(0);
  });

  it('a custom amount that matches no preset grants no bonus', () => {
    expect(computeRechargeBonus(333, PRESETS)).toBe(0);
  });

  it('rounds the bonus to 2 decimals (paise-safe)', () => {
    expect(computeRechargeBonus(250, PRESETS)).toBe(6.25);
    const odd: Preset[] = [{ amount: 199, mark: '', bonusPct: 3.5 }];
    // 199*3.5/100 = 6.9649999.. in IEEE-754, so toFixed(2) rounds DOWN to 6.96
    // (a sub-paise artifact, always in the house's favour).
    expect(computeRechargeBonus(199, odd)).toBe(6.96)
  });

  it('MONEY SAFETY: total credited = amount + bonus, bonus never negative', () => {
    for (const p of PRESETS) {
      const bonus = computeRechargeBonus(p.amount, PRESETS);
      expect(bonus).toBeGreaterThanOrEqual(0);
      expect(bonus).toBeCloseTo((p.amount * Math.max(0, p.bonusPct)) / 100, 2);
      expect(p.amount + bonus).toBeGreaterThanOrEqual(p.amount);
    }
  });

  it('a negative or NaN percentage is treated as no bonus, never a debit', () => {
    expect(computeRechargeBonus(100, [{ amount: 100, mark: '', bonusPct: -5 }])).toBe(0);
    expect(
      computeRechargeBonus(100, [{ amount: 100, mark: '', bonusPct: NaN }]),
    ).toBe(0);
  });
});

interface RechargeRecordLike {
  amount: number;
  bonusAmount: number;
  status: number;
}

// Mirrors admin-finance.approveRecharge (manual): admin approves the stated
// amount, so the full locked bonus applies.
const manualCredit = (r: RechargeRecordLike): number => {
  const bonus = Number(r.bonusAmount);
  return Number(r.amount) + bonus;
};

// Mirrors payment.service webhook (online): bonus is scaled down if the
// gateway reports LESS than was requested (underpay), full otherwise.
const onlineCredit = (r: RechargeRecordLike, reportedAmount: number): number => {
  const requested = Number(r.amount);
  const rawBonus = Number(r.bonusAmount);
  const bonus =
    requested > 0 && reportedAmount < requested
      ? Number(((rawBonus * reportedAmount) / requested).toFixed(2))
      : rawBonus;
  return reportedAmount + bonus;
};

describe('recharge bonus CREDIT contract (money path)', () => {
  it('POSITIVE manual: 100 with 1 bonus -> wallet gets 101', () => {
    expect(manualCredit({ amount: 100, bonusAmount: 1, status: 0 })).toBe(101);
  });

  it('POSITIVE online exact pay: 1000 requested, 1000 paid, 100 bonus -> 1100', () => {
    expect(onlineCredit({ amount: 1000, bonusAmount: 100, status: 0 }, 1000)).toBe(1100);
  });

  it('POSITIVE online overpay: paid more than requested still gets full bonus', () => {
    expect(onlineCredit({ amount: 1000, bonusAmount: 100, status: 0 }, 1200)).toBe(1300);
  });

  it('NEGATIVE online underpay exploit is blocked: request 1000 (bonus 100), pay 1 -> ~1.1, NOT 101', () => {
    const credited = onlineCredit({ amount: 1000, bonusAmount: 100, status: 0 }, 1);
    expect(credited).toBeCloseTo(1.1, 2); // 1 paid + 0.10 scaled bonus
    expect(credited).toBeLessThan(2);
  });

  it('NEGATIVE online half pay: bonus scales proportionally', () => {
    expect(onlineCredit({ amount: 1000, bonusAmount: 100, status: 0 }, 500)).toBe(550);
  });

  it('NEGATIVE zero bonus: credit equals the paid amount, never more', () => {
    expect(manualCredit({ amount: 150, bonusAmount: 0, status: 0 })).toBe(150);
    expect(onlineCredit({ amount: 150, bonusAmount: 0, status: 0 }, 150)).toBe(150);
  });

  it('INVARIANT: credited total is never less than the paid amount and bonus is never negative', () => {
    const cases: [number, number, number][] = [
      [100, 1, 100],
      [200, 10, 200],
      [1000, 100, 500],
      [1000, 100, 1],
      [250, 6.25, 250],
    ];
    for (const [amount, bonusAmount, paid] of cases) {
      const credited = onlineCredit({ amount, bonusAmount, status: 0 }, paid);
      expect(credited).toBeGreaterThanOrEqual(paid);
      expect(credited - paid).toBeGreaterThanOrEqual(0);
    }
  });
});
