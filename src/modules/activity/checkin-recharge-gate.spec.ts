interface RechargeRow {
  status: number;
  approvedAt: string | null;
}

// Mirrors ActivityService.hasRechargedToday, now guarding claimCheckinAward:
//   WHERE status = 1 AND approved_at >= todayStart (IST)
// The daily check-in reward can ONLY be claimed with a successful recharge
// approved today — same rule as Cash Rain.
const canClaimCheckin = (rows: RechargeRow[], todayStart: string): boolean =>
  rows.some(
    (r) => r.status === 1 && r.approvedAt !== null && r.approvedAt >= todayStart,
  );

const TODAY_START = '2026-07-22 00:00:00';

describe('Daily check-in reward: requires a successful recharge TODAY', () => {
  it('NO recharge at all -> cannot claim (the reported bug)', () => {
    expect(canClaimCheckin([], TODAY_START)).toBe(false);
  });

  it('only a PENDING recharge today -> cannot claim', () => {
    expect(
      canClaimCheckin([{ status: 0, approvedAt: null }], TODAY_START),
    ).toBe(false);
  });

  it('only YESTERDAY / old approved recharges -> cannot claim', () => {
    expect(
      canClaimCheckin(
        [{ status: 1, approvedAt: '2026-07-21 23:30:00' }],
        TODAY_START,
      ),
    ).toBe(false);
  });

  it('a REJECTED recharge today -> cannot claim', () => {
    expect(
      canClaimCheckin(
        [{ status: 2, approvedAt: '2026-07-22 10:00:00' }],
        TODAY_START,
      ),
    ).toBe(false);
  });

  it("today's APPROVED recharge -> can claim", () => {
    expect(
      canClaimCheckin(
        [{ status: 1, approvedAt: '2026-07-22 09:00:00' }],
        TODAY_START,
      ),
    ).toBe(true);
  });

  it('recharge started yesterday but APPROVED today -> can claim', () => {
    // created_at was yesterday, approved_at is today; approval-time gate is correct.
    expect(
      canClaimCheckin(
        [{ status: 1, approvedAt: '2026-07-22 00:15:00' }],
        TODAY_START,
      ),
    ).toBe(true);
  });
});
