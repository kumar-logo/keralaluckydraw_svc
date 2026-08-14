import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS: {
  code: string;
  name: string;
  group: string;
  sort: number;
}[] = [
  { code: 'dashboard', name: 'Dashboard', group: 'core', sort: 1 },
  { code: 'users', name: 'Users', group: 'core', sort: 2 },
  { code: 'games', name: 'Games', group: 'gameplay', sort: 3 },
  { code: 'lottery', name: 'Lottery', group: 'gameplay', sort: 4 },
  { code: 'orders', name: 'Orders', group: 'gameplay', sort: 5 },
  { code: 'finance', name: 'Finance', group: 'finance', sort: 6 },
  { code: 'content', name: 'Content', group: 'content', sort: 7 },
  { code: 'reports', name: 'Reports', group: 'reports', sort: 8 },
  { code: 'system', name: 'System Settings', group: 'system', sort: 9 },
  { code: 'earn', name: 'Earn / Rewards', group: 'gameplay', sort: 10 },
];

const ROLES: {
  name: string;
  displayName: string;
  level: number;
  description: string;
  permissions: string[];
}[] = [
  {
    name: 'super_admin',
    displayName: 'Super Admin',
    level: 100,
    description: 'Full system access',
    permissions: [
      'dashboard',
      'users',
      'games',
      'lottery',
      'orders',
      'finance',
      'content',
      'reports',
      'system',
      'earn',
    ],
  },
  {
    name: 'admin',
    displayName: 'Admin',
    level: 80,
    description: 'Manage games, finance, and content',
    permissions: [
      'dashboard',
      'users',
      'games',
      'lottery',
      'orders',
      'finance',
      'content',
      'reports',
      'earn',
    ],
  },
  {
    name: 'operator',
    displayName: 'Operator',
    level: 60,
    description: 'Handle daily operations',
    permissions: ['dashboard', 'orders', 'games', 'lottery', 'reports'],
  },
  {
    name: 'viewer',
    displayName: 'Viewer',
    level: 20,
    description: 'View-only access to reports',
    permissions: ['dashboard', 'reports'],
  },
];

export class DynamicRoles1736100000000 implements MigrationInterface {
  name = 'DynamicRoles1736100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`roles\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(50) NOT NULL,
        \`display_name\` varchar(100) NOT NULL,
        \`level\` int NOT NULL DEFAULT 0,
        \`description\` varchar(255) NULL,
        \`is_system\` tinyint NOT NULL DEFAULT 0,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_role_name\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`permissions\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`code\` varchar(50) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`group_name\` varchar(50) NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_permission_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`role_permissions\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`role_id\` int unsigned NOT NULL,
        \`permission_id\` int unsigned NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_role_permission\` (\`role_id\`, \`permission_id\`),
        KEY \`idx_roleperm_role\` (\`role_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const permIdByCode = new Map<string, number>();
    for (const p of PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO permissions (code, name, group_name, sort_order) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), group_name = VALUES(group_name), sort_order = VALUES(sort_order)`,
        [p.code, p.name, p.group, p.sort],
      );
      const rows: { id: number }[] = await queryRunner.query(
        `SELECT id FROM permissions WHERE code = ?`,
        [p.code],
      );
      if (rows.length > 0) permIdByCode.set(p.code, rows[0].id);
    }

    for (const r of ROLES) {
      await queryRunner.query(
        `INSERT INTO roles (name, display_name, level, description, is_system) VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), level = VALUES(level), description = VALUES(description), is_system = VALUES(is_system)`,
        [r.name, r.displayName, r.level, r.description],
      );
      const roleRows: { id: number }[] = await queryRunner.query(
        `SELECT id FROM roles WHERE name = ?`,
        [r.name],
      );
      if (roleRows.length === 0) continue;
      const roleId = roleRows[0].id;
      for (const code of r.permissions) {
        const permId = permIdByCode.get(code);
        if (permId) {
          await queryRunner.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE permission_id = VALUES(permission_id)`,
            [roleId, permId],
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`role_permissions\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`permissions\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`roles\``);
  }
}
