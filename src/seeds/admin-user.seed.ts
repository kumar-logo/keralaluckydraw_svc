import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AdminUser } from '../entities/admin-user.entity';

export async function seedAdminUser(ds: DataSource) {
  const repo = ds.getRepository(AdminUser);

  const existing = await repo.findOne({ where: { username: 'admin' } });
  if (existing) {
    console.log('[AdminUser] Skipped (admin already exists)');
    return;
  }

  const passwordHash = await bcrypt.hash('admin123', 10);

  await repo.save(
    repo.create({
      username: 'admin',
      passwordHash,
      displayName: 'Super Admin',
      role: 'super_admin',
      status: 1,
    }),
  );

  console.log(
    '[AdminUser] Created default admin (username: admin, password: admin123)',
  );
}
