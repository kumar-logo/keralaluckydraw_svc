import { DataSource } from 'typeorm';
import { Announcement } from '../entities/announcement.entity';

const announcements = [
  {
    title: 'Draw Schedule',
    content:
      'Kerala daily draws run every day. Check the lottery page for the next draw time.',
    announcementType: 'notice',
    linkUrl: '/lottery',
    sortOrder: 1,
    status: 1,
  },
  {
    title: 'Play Responsibly',
    content:
      'Set your limits and never bet more than you can afford to lose. Play for fun.',
    announcementType: 'notice',
    linkUrl: '',
    sortOrder: 2,
    status: 1,
  },
];

export async function seedAnnouncements(ds: DataSource) {
  const repo = ds.getRepository(Announcement);

  console.log('[Announcements] Clearing existing announcement data...');
  await repo.clear();

  let created = 0;
  for (const a of announcements) {
    await repo.save(repo.create(a as Partial<Announcement>));
    created++;
  }

  console.log(`[Announcements] Created: ${created} announcements`);
}
