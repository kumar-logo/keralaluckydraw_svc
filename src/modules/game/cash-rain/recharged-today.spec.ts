interface RechargeRow {
  status: number;
  approvedAt: string | null;
}

// Mirrors hasRechargedToday's SQL predicate:
//   WHERE status = 1 AND approved_at >= todayStart
// approved_at is the SUCCESS time (set on the status->1 flip), so a recharge
// initiated yesterday but approved today correctly counts, and one initiated
// today but not yet approved does not.
const isEligibleToday = (rows: RechargeRow[], todayStart: string): boolean =>
  rows.some(
    (r) => r.status === 1 && r.approvedAt !== null && r.approvedAt >= todayStart,
  );

const TODAY_START = '2026-07-22 00:00:00';

describe('Cash Rain: recharged-today eligibility keys on APPROVAL time', () => {
  it('recharge initiated yesterday but APPROVED today -> eligible', () => {
    expect(
      isEligibleToday(
        [{ status: 1, approvedAt: '2026-07-22 09:00:00' }],
        TODAY_START,
      ),
    ).toBe(true);
  });

  it('recharge initiated AND approved today -> eligible', () => {
    expect(
      isEligibleToday(
        [{ status: 1, approvedAt: '2026-07-22 14:30:00' }],
        TODAY_START,
      ),
    ).toBe(true);
  });

  it('recharge approved YESTERDAY -> NOT eligible today', () => {
    expect(
      isEligibleToday(
        [{ status: 1, approvedAt: '2026-07-21 23:59:59' }],
        TODAY_START,
      ),
    ).toBe(false);
  });

  it('recharge created today but still PENDING (never approved) -> NOT eligible', () => {
    expect(
      isEligibleToday([{ status: 0, approvedAt: null }], TODAY_START),
    ).toBe(false);
  });

  it('REJECTED / CANCELLED recharges never count', () => {
    expect(
      isEligibleToday(
        [
          { status: 2, approvedAt: '2026-07-22 10:00:00' },
          { status: 3, approvedAt: '2026-07-22 10:00:00' },
        ],
        TODAY_START,
      ),
    ).toBe(false);
  });

  it('THE BUG that was fixed: yesterday-initiated + today-approved must NOT be blocked', () => {
    // Old gate filtered created_at >= todayStart; created_at was 2026-07-21 23:00,
    // so the eligible user was wrongly blocked. The new gate uses approved_at.
    const rows: RechargeRow[] = [{ status: 1, approvedAt: '2026-07-22 09:00:00' }];
    expect(isEligibleToday(rows, TODAY_START)).toBe(true);
  });

  it('WITHOUT any recharge (no rows) -> NOT eligible (both Daily Cash and Cash Rain share this gate)', () => {
    expect(isEligibleToday([], TODAY_START)).toBe(false);
  });

  it('ONLY old recharges (all approved before today) -> NOT eligible', () => {
    expect(
      isEligibleToday(
        [
          { status: 1, approvedAt: '2026-07-20 10:00:00' },
          { status: 1, approvedAt: '2026-07-21 22:00:00' },
        ],
        TODAY_START,
      ),
    ).toBe(false);
  });

  it('a mix: only a today-approved successful row makes the user eligible', () => {
    const rows: RechargeRow[] = [
      { status: 1, approvedAt: '2026-07-20 12:00:00' }, // old success
      { status: 0, approvedAt: null }, // pending
      { status: 2, approvedAt: '2026-07-22 08:00:00' }, // rejected today
      { status: 1, approvedAt: '2026-07-22 08:05:00' }, // success today
    ];
    expect(isEligibleToday(rows, TODAY_START)).toBe(true);
  });
});
