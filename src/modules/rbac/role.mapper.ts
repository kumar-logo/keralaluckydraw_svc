import { Role } from '../../entities/role.entity';

export interface RoleView {
  id: number;
  name: string;
  displayName: string;
  level: number;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export function toRoleView(
  role: Role,
  permissions: string[],
  userCount: number,
): RoleView {
  return {
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    level: role.level,
    description: role.description === null ? '' : role.description,
    isSystem: role.isSystem === 1,
    userCount,
    permissions,
  };
}
