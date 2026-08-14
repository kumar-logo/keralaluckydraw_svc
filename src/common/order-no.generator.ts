import { randomInt } from 'crypto';

const SEQUENCE_MODULO = 1000000;
const SEQUENCE_DIGITS = 6;
const RANDOM_BOUND = 1000000000;
const RANDOM_DIGITS = 9;

let sequence = randomInt(SEQUENCE_MODULO);

export const buildOrderNo = (prefix: string): string => {
  sequence = (sequence + 1) % SEQUENCE_MODULO;
  const seq = String(sequence).padStart(SEQUENCE_DIGITS, '0');
  const rand = String(randomInt(RANDOM_BOUND)).padStart(RANDOM_DIGITS, '0');
  return `${prefix}${Date.now()}${seq}${rand}`;
};
