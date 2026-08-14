import { DataSource, DeepPartial } from 'typeorm';
import { TransactionType } from '../entities/transaction-type.entity';

const types = [
  {
    typeCode: 'recharge',
    typeName: 'Recharge',
    category: 'income',
    filterGroup: 'recharge',
  },
  {
    typeCode: 'withdraw',
    typeName: 'Withdrawal',
    category: 'expense',
    filterGroup: 'withdraw',
  },
  {
    typeCode: 'withdraw_refund',
    typeName: 'Withdrawal Refund',
    category: 'income',
    filterGroup: 'withdraw',
  },
  { typeCode: 'bet', typeName: 'Bet', category: 'expense', filterGroup: 'bet' },
  {
    typeCode: 'wheel_draw',
    typeName: 'Lucky Spin',
    category: 'expense',
    filterGroup: 'bet',
  },
  {
    typeCode: 'box_draw',
    typeName: 'Mystery Box',
    category: 'expense',
    filterGroup: 'bet',
  },
  {
    typeCode: 'win',
    typeName: 'Winning',
    category: 'income',
    filterGroup: 'win',
  },
  {
    typeCode: 'win_bonus',
    typeName: 'Bonus Winning',
    category: 'income',
    filterGroup: 'win',
  },
  {
    typeCode: 'third_party_bet',
    typeName: 'Game Bet',
    category: 'expense',
    filterGroup: 'bet',
  },
  {
    typeCode: 'third_party_win',
    typeName: 'Game Win',
    category: 'income',
    filterGroup: 'win',
  },
  {
    typeCode: 'cashrain',
    typeName: 'Cash Rain',
    category: 'income',
    filterGroup: 'win',
  },
  {
    typeCode: 'commission',
    typeName: 'Commission',
    category: 'income',
    filterGroup: '',
  },
  {
    typeCode: 'rebate',
    typeName: 'Rebate',
    category: 'income',
    filterGroup: '',
  },
  { typeCode: 'bonus', typeName: 'Bonus', category: 'income', filterGroup: '' },
  {
    typeCode: 'transfer',
    typeName: 'Transfer',
    category: 'adjust',
    filterGroup: '',
  },
  {
    typeCode: 'checkin',
    typeName: 'Check-in Reward',
    category: 'income',
    filterGroup: '',
  },
  {
    typeCode: 'wage',
    typeName: 'Weekly Wage',
    category: 'income',
    filterGroup: '',
  },
  {
    typeCode: 'vip_reward',
    typeName: 'VIP Reward',
    category: 'income',
    filterGroup: '',
  },
  {
    typeCode: 'rank_reward',
    typeName: 'Ranking Reward',
    category: 'income',
    filterGroup: '',
  },
  {
    typeCode: 'cdkey',
    typeName: 'Gift Code',
    category: 'income',
    filterGroup: '',
  },
  {
    typeCode: 'refund',
    typeName: 'Refund',
    category: 'income',
    filterGroup: '',
  },
  {
    typeCode: 'adjustment',
    typeName: 'Balance Adjustment',
    category: 'adjust',
    filterGroup: '',
  },
  {
    typeCode: 'recharge_failed',
    typeName: 'Recharge Failed',
    category: 'adjust',
    filterGroup: '',
  },
];

export async function seedTransactionTypes(ds: DataSource) {
  const repo = ds.getRepository(TransactionType);

  console.log('[TransactionType] Clearing existing transaction types...');
  await repo.clear();

  let created = 0;
  for (const t of types) {
    await repo.save(repo.create(t as DeepPartial<TransactionType>));
    created++;
  }

  console.log(`[TransactionType] Created: ${created} transaction types`);
}
