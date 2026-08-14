import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateGameResultConfigDto } from './admin.dto';

const check = (payload: Record<string, unknown>) => {
  const dto = plainToInstance(UpdateGameResultConfigDto, payload);
  const errors = validateSync(dto as object, { whitelist: false });
  return {
    ok: errors.length === 0,
    messages: errors.flatMap((e) => Object.values(e.constraints ?? {})),
    dto,
  };
};

describe('UpdateGameResultConfigDto', () => {
  it('accepts the admin payload that previously returned 400 (tinyint 0/1 flags)', () => {
    const res = check({
      resultMode: 'max_profit',
      houseEdgeTarget: 0.15,
      holdForApproval: 0,
      avoidBigPrize: 0,
      avoidZeroOrder: 0,
    });
    expect(res.messages).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it('coerces 0/1 to real booleans so the service stores the right tinyint', () => {
    const res = check({
      holdForApproval: 1,
      avoidBigPrize: 0,
      avoidZeroOrder: 1,
    });
    expect(res.ok).toBe(true);
    expect(res.dto.holdForApproval).toBe(true);
    expect(res.dto.avoidBigPrize).toBe(false);
    expect(res.dto.avoidZeroOrder).toBe(true);
  });

  it('still accepts genuine booleans from the toggle switches', () => {
    const res = check({ avoidBigPrize: true, holdForApproval: false });
    expect(res.ok).toBe(true);
    expect(res.dto.avoidBigPrize).toBe(true);
    expect(res.dto.holdForApproval).toBe(false);
  });

  it('accepts a decimal houseEdgeTarget (0.15) which @IsInt used to reject', () => {
    const res = check({ houseEdgeTarget: 0.15 });
    expect(res.messages).toEqual([]);
    expect(res.dto.houseEdgeTarget).toBe(0.15);
  });

  it('accepts the UI slider bounds 0 and 0.95', () => {
    expect(check({ houseEdgeTarget: 0 }).ok).toBe(true);
    expect(check({ houseEdgeTarget: 0.95 }).ok).toBe(true);
  });

  it('rejects an out-of-range houseEdgeTarget', () => {
    expect(check({ houseEdgeTarget: 1.5 }).ok).toBe(false);
    expect(check({ houseEdgeTarget: -0.1 }).ok).toBe(false);
  });

  it('rejects a non-boolean flag rather than silently coercing it', () => {
    const res = check({ avoidBigPrize: 'yes' });
    expect(res.ok).toBe(false);
  });

  it('accepts every valid result mode and rejects an unknown one', () => {
    for (const mode of [
      'random',
      'weighted',
      'min_payout',
      'max_profit',
      'lowest_risk',
      'manual',
    ]) {
      expect(check({ resultMode: mode }).ok).toBe(true);
    }
    expect(check({ resultMode: 'sneaky_mode' }).ok).toBe(false);
  });

  it('allows a partial patch (all fields optional)', () => {
    expect(check({}).ok).toBe(true);
    expect(check({ avoidBigPrize: true }).ok).toBe(true);
  });
});
