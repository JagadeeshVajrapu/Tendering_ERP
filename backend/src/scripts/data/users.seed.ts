import { UserRole } from '../../types';

export interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: string;
  isActive: boolean;
}

/**
 * Default demo users for TenderNova.
 * Password for all accounts: password123
 */
export const seedUsers: SeedUser[] = [
  // Executive
  {
    name: 'Executive1',
    email: 'executive@tendererp.com',
    password: 'password123',
    role: UserRole.EXECUTIVE,
    department: 'Tendering',
    isActive: true,
  },
  {
    name: 'Executive2',
    email: 'executive2@tendererp.com',
    password: 'password123',
    role: UserRole.EXECUTIVE,
    department: 'Tendering',
    isActive: true,
  },

  // Managing Director
  {
    name: 'Managing director',
    email: 'md@tendererp.com',
    password: 'password123',
    role: UserRole.MD,
    department: 'Management',
    isActive: true,
  },

  {
    name: 'Financial',
    email: 'finance1@tendererp.com',
    password: 'password123',
    role: UserRole.FINANCE,
    department: 'Finance',
    isActive: true,
  },

  // Manager (Compliance)
  {
    name: 'Manager',
    email: 'manager@tendererp.com',
    password: 'password123',
    role: UserRole.MANAGER,
    department: 'Compliance',
    isActive: true,
  },
];

export const DEFAULT_SEED_PASSWORD = 'password123';
