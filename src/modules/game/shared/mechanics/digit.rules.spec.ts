import { Digit3Mechanic, Digit5Mechanic } from './digit.mechanic';
import { GameMechanicsConfig, FAMILY_DEFAULTS } from '../game-config.types';

// Pure mechanic unit tests for the NON-SLAT digit bet types.
// Every key here is read straight from rulesFor()/applyRule() in
// digit.mechanic.ts so the assertions track the real rule table.
//
// Notes derived from the source:
//  - oddsKey returned by evaluate() is the resolved key itself
//    (betContent.betType ?? betType), NOT the canonical rule name.
//  - tickets are read from betContent.numbers.
//  - 'size' (big/small) and 'parity' (odd/even) are TICKET-INDEPENDENT:
//    they compare the result-digit sum against cfg.bigSmallThreshold
//    (default 13) / sum parity and ignore the ticket entirely.

function cfg3(): GameMechanicsConfig {
  return { ...FAMILY_DEFAULTS.digit3, digitCount: 3 };
}

function cfg5(): GameMechanicsConfig {
  return { ...FAMILY_DEFAULTS.digit5, digitCount: 5 };
}

function result3(number: string) {
  const digits = number.split('').map((d) => parseInt(d, 10));
  return { number, digits, drawResult: number };
}

function result5(number: string) {
  const digits = number.split('').map((d) => parseInt(d, 10));
  return { number, digits, drawResult: number };
}

function eval3(betType: string, ticket: string, drawNumber: string) {
  return Digit3Mechanic.evaluate({
    betType,
    betContent: { numbers: ticket, betType },
    result: result3(drawNumber),
    cfg: cfg3(),
  });
}

function eval5(betType: string, ticket: string, drawNumber: string) {
  return Digit5Mechanic.evaluate({
    betType,
    betContent: { numbers: ticket, betType },
    result: result5(drawNumber),
    cfg: cfg5(),
  });
}

// ---------------------------------------------------------------------------
// 3-DIGIT GAME (Digit3Mechanic, digitCount = 3)
// ---------------------------------------------------------------------------
describe('Digit3Mechanic — non-slat bet types (digitCount=3)', () => {
  const DRAW = '123'; // digits [1,2,3], sum = 6 (<= 13 => small, even)

  // --- exact / straight / exact3 / '3' (match: exact) ---------------------
  describe.each(['exact', 'straight', 'exact3', '3'])(
    'exact-class key "%s"',
    (key) => {
      it('wins on a full match', () => {
        const o = eval3(key, '123', DRAW);
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses on any mismatch', () => {
        const o = eval3(key, '124', DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    },
  );

  // --- box / any_order (match: box) ---------------------------------------
  describe.each(['box', 'any_order'])('box-class key "%s"', (key) => {
    it('wins when the same digits appear in a different order', () => {
      const o = eval3(key, '321', DRAW);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe(key);
    });
    it('loses when the digit multiset differs', () => {
      const o = eval3(key, '329', DRAW);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe(key);
    });
  });

  // --- prefix: front2 / front_pair / first2 (len 2) -----------------------
  describe.each(['front2', 'front_pair', 'first2'])(
    'prefix-2 key "%s"',
    (key) => {
      it('wins when the first two digits match', () => {
        const o = eval3(key, '129', DRAW);
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses when the first two digits differ', () => {
        const o = eval3(key, '923', DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    },
  );

  // --- prefix: first1 (len 1) ---------------------------------------------
  it('first1 wins on a leading-digit match', () => {
    const o = eval3('first1', '199', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('first1');
  });
  it('first1 loses on a leading-digit mismatch', () => {
    const o = eval3('first1', '923', DRAW);
    expect(o.won).toBe(false);
  });

  // --- prefix: first3 (len 3, full prefix on a 3-digit draw) --------------
  it('first3 wins when all three leading digits match', () => {
    const o = eval3('first3', '123', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('first3');
  });
  it('first3 loses on a mismatch', () => {
    const o = eval3('first3', '124', DRAW);
    expect(o.won).toBe(false);
  });

  // --- suffix: back2 / back_pair / last2 / '2' / exact2 (len 2) -----------
  describe.each(['back2', 'back_pair', 'last2', '2', 'exact2'])(
    'suffix-2 key "%s"',
    (key) => {
      it('wins when the last two digits match', () => {
        const o = eval3(key, '923', DRAW);
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses when the last two digits differ', () => {
        const o = eval3(key, '129', DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    },
  );

  // --- suffix: last1 / '1' / exact1 (len 1) -------------------------------
  describe.each(['last1', '1', 'exact1'])('suffix-1 key "%s"', (key) => {
    it('wins when the last digit matches', () => {
      const o = eval3(key, '993', DRAW);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe(key);
    });
    it('loses when the last digit differs', () => {
      const o = eval3(key, '991', DRAW);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe(key);
    });
  });

  // --- position: first / second / third -----------------------------------
  it('first (position 0) wins when digit at index 0 matches', () => {
    const o = eval3('first', '199', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('first');
  });
  it('first (position 0) loses when digit at index 0 differs', () => {
    expect(eval3('first', '923', DRAW).won).toBe(false);
  });
  it('second (position 1) wins when digit at index 1 matches', () => {
    const o = eval3('second', '929', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('second');
  });
  it('second (position 1) loses when digit at index 1 differs', () => {
    expect(eval3('second', '993', DRAW).won).toBe(false);
  });
  it('third (position 2) wins when digit at index 2 matches', () => {
    const o = eval3('third', '993', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('third');
  });
  it('third (position 2) loses when digit at index 2 differs', () => {
    expect(eval3('third', '991', DRAW).won).toBe(false);
  });

  // --- sum (match: sum) — ticket parsed as an integer == digit sum --------
  it('sum wins when the ticket integer equals the digit sum', () => {
    const o = eval3('sum', '006', DRAW); // sum of 1+2+3 = 6
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('sum');
  });
  it('sum loses when the ticket integer differs from the digit sum', () => {
    const o = eval3('sum', '007', DRAW);
    expect(o.won).toBe(false);
  });

  // --- size: big / sum_big / small / sum_small (TICKET-INDEPENDENT) -------
  // threshold = 13 (default). DRAW sum = 6 => small wins, big loses.
  // A high-sum draw (sum > 13) flips the outcome; ticket value is ignored.
  describe('size (ticket-independent, threshold=13)', () => {
    const BIG_DRAW = '999'; // sum 27 > 13
    describe.each(['big', 'sum_big'])('big key "%s"', (key) => {
      it('wins when sum > threshold (ticket ignored)', () => {
        const o = eval3(key, '000', BIG_DRAW);
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses when sum <= threshold', () => {
        const o = eval3(key, '999', DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    });
    describe.each(['small', 'sum_small'])('small key "%s"', (key) => {
      it('wins when sum <= threshold (ticket ignored)', () => {
        const o = eval3(key, '999', DRAW);
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses when sum > threshold', () => {
        const o = eval3(key, '000', BIG_DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    });
  });

  // --- parity: odd / sum_odd / even / sum_even (TICKET-INDEPENDENT) -------
  // DRAW sum = 6 => even wins, odd loses. An odd-sum draw flips it.
  describe('parity (ticket-independent)', () => {
    const ODD_DRAW = '124'; // sum 7 (odd)
    describe.each(['even', 'sum_even'])('even key "%s"', (key) => {
      it('wins on an even sum (ticket ignored)', () => {
        const o = eval3(key, '999', DRAW); // sum 6 even
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses on an odd sum', () => {
        const o = eval3(key, '000', ODD_DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    });
    describe.each(['odd', 'sum_odd'])('odd key "%s"', (key) => {
      it('wins on an odd sum (ticket ignored)', () => {
        const o = eval3(key, '000', ODD_DRAW); // sum 7 odd
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses on an even sum', () => {
        const o = eval3(key, '999', DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 5-DIGIT GAME (Digit5Mechanic, digitCount = 5)
// position / prefix / suffix + size / parity
// ---------------------------------------------------------------------------
describe('Digit5Mechanic — position/prefix/suffix + size/parity (digitCount=5)', () => {
  const DRAW = '12345'; // digits [1,2,3,4,5], sum = 15 (<= 23 => small, odd)

  // --- exact5 (match: exact) ----------------------------------------------
  it('exact5 wins on a full 5-digit match', () => {
    const o = eval5('exact5', '12345', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('exact5');
  });
  it('exact5 loses on any mismatch', () => {
    const o = eval5('exact5', '12346', DRAW);
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('exact5');
  });

  // --- position: first..fifth ---------------------------------------------
  const positions: Array<[string, number, string, string]> = [
    // [key, index, winningTicket, losingTicket]
    ['first', 0, '19999', '99999'],
    ['second', 1, '92999', '99999'],
    ['third', 2, '99399', '99999'],
    ['fourth', 3, '99949', '99999'],
    ['fifth', 4, '99995', '99999'],
  ];
  describe.each(positions)(
    'position key "%s" (index %i)',
    (key, _idx, winTicket, loseTicket) => {
      it('wins when the digit at that position matches', () => {
        const o = eval5(key, winTicket, DRAW);
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses when the digit at that position differs', () => {
        const o = eval5(key, loseTicket, DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    },
  );

  // --- prefix: front2 (len 2) / first3 (len 3) / first4 (len 4) -----------
  it('front2 wins when the first two digits match', () => {
    const o = eval5('front2', '12999', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('front2');
  });
  it('front2 loses when the first two digits differ', () => {
    expect(eval5('front2', '99345', DRAW).won).toBe(false);
  });
  it('first3 wins when the first three digits match', () => {
    const o = eval5('first3', '12399', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('first3');
  });
  it('first3 loses when the first three digits differ', () => {
    expect(eval5('first3', '99945', DRAW).won).toBe(false);
  });
  it('first4 wins when the first four digits match', () => {
    const o = eval5('first4', '12349', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('first4');
  });
  it('first4 loses when the first four digits differ', () => {
    expect(eval5('first4', '99995', DRAW).won).toBe(false);
  });

  // --- suffix: back2 (len 2) / last3 (len 3) / last4 (len 4) --------------
  it('back2 wins when the last two digits match', () => {
    const o = eval5('back2', '99945', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('back2');
  });
  it('back2 loses when the last two digits differ', () => {
    expect(eval5('back2', '12399', DRAW).won).toBe(false);
  });
  it('last3 wins when the last three digits match', () => {
    const o = eval5('last3', '99345', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('last3');
  });
  it('last3 loses when the last three digits differ', () => {
    expect(eval5('last3', '12399', DRAW).won).toBe(false);
  });
  it('last4 wins when the last four digits match', () => {
    const o = eval5('last4', '92345', DRAW);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('last4');
  });
  it('last4 loses when the last four digits differ', () => {
    expect(eval5('last4', '12399', DRAW).won).toBe(false);
  });

  // --- size: big / small (TICKET-INDEPENDENT) -----------------------------
  // digit5 default bigSmallThreshold = 23. DRAW sum = 15 <= 23 => small.
  // A high-sum draw (sum > 23) is big; ticket value is ignored throughout.
  describe('size (ticket-independent, digit5 threshold=23)', () => {
    const BIG_DRAW = '99999'; // sum 45 > 23
    describe.each(['big', 'sum_big'])('big key "%s"', (key) => {
      it('wins when sum > threshold (ticket ignored)', () => {
        const o = eval5(key, '00000', BIG_DRAW);
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses when sum <= threshold', () => {
        const o = eval5(key, '99999', DRAW); // sum 15 <= 23
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    });
    describe.each(['small', 'sum_small'])('small key "%s"', (key) => {
      it('wins when sum <= threshold (ticket ignored)', () => {
        const o = eval5(key, '99999', DRAW); // sum 15 <= 23
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses when sum > threshold', () => {
        const o = eval5(key, '00000', BIG_DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    });
  });

  // --- parity: odd / even (TICKET-INDEPENDENT) ----------------------------
  // DRAW sum = 15 => odd wins, even loses. An even-sum draw flips it.
  describe('parity (ticket-independent)', () => {
    const EVEN_DRAW = '12344'; // sum 14 (even)
    describe.each(['odd', 'sum_odd'])('odd key "%s"', (key) => {
      it('wins on an odd sum (ticket ignored)', () => {
        const o = eval5(key, '00000', DRAW); // sum 15 odd
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses on an even sum', () => {
        const o = eval5(key, '99999', EVEN_DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    });
    describe.each(['even', 'sum_even'])('even key "%s"', (key) => {
      it('wins on an even sum (ticket ignored)', () => {
        const o = eval5(key, '99999', EVEN_DRAW); // sum 14 even
        expect(o.won).toBe(true);
        expect(o.oddsKey).toBe(key);
      });
      it('loses on an odd sum', () => {
        const o = eval5(key, '00000', DRAW);
        expect(o.won).toBe(false);
        expect(o.oddsKey).toBe(key);
      });
    });
  });
});
