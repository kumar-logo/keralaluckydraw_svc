import { DataSource } from 'typeorm';
import { Popup } from '../entities/popup.entity';

const popups = [
  {
    title: 'Welcome to Kerala Lottery',
    content:
      'Play daily draws and win big. New users get a welcome bonus on their first recharge.',
    imageUrl: '/uploads/popups/welcome.jpg',
    linkUrl: '/promotions',
    popupType: 'home',
    frequency: 'once',
    sortOrder: 1,
    status: 1,
  },
  {
    title: 'Daily Check-in Rewards',
    content:
      'Check in every day to claim free rewards. Miss a day and your streak resets.',
    imageUrl: '/uploads/popups/checkin.jpg',
    linkUrl: '/checkin',
    popupType: 'home',
    frequency: 'daily',
    sortOrder: 2,
    status: 1,
  },
];

export async function seedPopups(ds: DataSource) {
  const repo = ds.getRepository(Popup);

  console.log('[Popups] Clearing existing popup data...');
  await repo.clear();

  let created = 0;
  for (const p of popups) {
    await repo.save(repo.create(p as Partial<Popup>));
    created++;
  }

  console.log(`[Popups] Created: ${created} popups`);
}
