import { ProfilePrivacy, Role, UserStatus } from '@prisma/client';

export interface SeedUserFixture {
  key: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  status: UserStatus;
  profile_privacy: ProfilePrivacy;
  bio: string;
  city: string;
  birth_date: Date;
  avatar_url: string | null;
  is_two_factor_enabled?: boolean;
  plainTwoFactorSecret?: string;
  banned_until?: Date | null;
  deleted_at?: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildSeedUsers(now: Date = new Date()): SeedUserFixture[] {
  const baselineUsers: SeedUserFixture[] = [
    {
      key: 'marghe_admin',
      username: 'marghe_admin',
      email: 'marghe@example.com',
      first_name: 'Margherita',
      last_name: 'Dallolio',
      role: Role.admin,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Platform administrator and Neapolitan pizza enthusiast.',
      city: 'Firenze',
      birth_date: new Date('1994-05-14'),
      avatar_url:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    },
    {
      key: 'sarah_mod',
      username: 'sarah_mod',
      email: 'sarah@example.com',
      first_name: 'Sarah',
      last_name: 'Jenkins',
      role: Role.moderator,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Community moderator keeping WeCook welcoming and safe.',
      city: 'London',
      birth_date: new Date('1992-08-22'),
      avatar_url:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    },
    {
      key: 'mario_bianchi',
      username: 'mario_bianchi',
      email: 'mario@example.com',
      first_name: 'Mario',
      last_name: 'Bianchi',
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Home cook exploring traditional Italian and Mediterranean dishes.',
      city: 'Roma',
      birth_date: new Date('1991-03-10'),
      avatar_url:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    },
    {
      key: 'giuly_cooks',
      username: 'giuly_cooks',
      email: 'giulia@example.com',
      first_name: 'Giulia',
      last_name: 'Verdi',
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Fresh pasta lover and weekend sourdough baker.',
      city: 'Bologna',
      birth_date: new Date('1995-11-02'),
      avatar_url:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    },
    {
      key: 'chef_marco',
      username: 'chef_marco',
      email: 'marco@example.com',
      first_name: 'Marco',
      last_name: 'Rossi',
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Professional chef sharing seasonal restaurant techniques.',
      city: 'Milano',
      birth_date: new Date('1988-07-19'),
      avatar_url:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    },
    {
      key: 'sophie_pastry',
      username: 'sophie_pastry',
      email: 'sophie@example.com',
      first_name: 'Sophie',
      last_name: 'Dubois',
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.friends_only,
      bio: 'French pastry chef obsessed with croissants and tarts.',
      city: 'Lyon',
      birth_date: new Date('1993-02-27'),
      avatar_url:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    },
    {
      key: 'kenji_noodles',
      username: 'kenji_noodles',
      email: 'kenji@example.com',
      first_name: 'Kenji',
      last_name: 'Tanaka',
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Ramen broths, hand-pulled noodles, and umami experiments.',
      city: 'Osaka',
      birth_date: new Date('1990-09-05'),
      avatar_url:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    },
    {
      key: 'elena_vegan',
      username: 'elena_vegan',
      email: 'elena@example.com',
      first_name: 'Elena',
      last_name: 'Rostova',
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.friends_only,
      bio: 'Plant-based comfort food and colorful bowls.',
      city: 'Torino',
      birth_date: new Date('1996-01-18'),
      avatar_url:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
    },
    {
      key: 'carlos_mex',
      username: 'carlos_mex',
      email: 'carlos@example.com',
      first_name: 'Carlos',
      last_name: 'Ramirez',
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Authentic tacos, salsas, and slow-cooked mole.',
      city: 'Madrid',
      birth_date: new Date('1989-12-08'),
      avatar_url:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
    },
    {
      key: 'alex_secure',
      username: 'alex_secure',
      email: 'alex2fa@example.com',
      first_name: 'Alex',
      last_name: 'Vance',
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.private,
      bio: 'Security-conscious home baker with 2FA enabled.',
      city: 'Zurich',
      birth_date: new Date('1992-04-21'),
      avatar_url:
        'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400',
      is_two_factor_enabled: true,
      plainTwoFactorSecret: 'JBSWY3DPEHPK3PXP',
    },
    {
      key: 'luca_disattivato',
      username: 'luca_disattivato',
      email: 'luca@example.com',
      first_name: 'Luca',
      last_name: 'Neri',
      role: Role.user,
      status: UserStatus.disabled,
      profile_privacy: ProfilePrivacy.private,
      bio: 'Account deactivated by user.',
      city: 'Napoli',
      birth_date: new Date('1993-06-30'),
      avatar_url: null,
      deleted_at: new Date(now.getTime() - 45 * DAY_MS),
    },
    {
      key: 'ex_utente',
      username: 'ex_utente',
      email: 'ex@example.com',
      first_name: 'Former',
      last_name: 'Member',
      role: Role.user,
      status: UserStatus.disabled,
      profile_privacy: ProfilePrivacy.private,
      bio: 'Former community member whose public recipes remain under platform custody.',
      city: 'Genova',
      birth_date: new Date('1987-10-12'),
      avatar_url: null,
      deleted_at: new Date(now.getTime() - 60 * DAY_MS),
    },
    {
      key: 'spam_bot',
      username: 'spam_bot',
      email: 'spam@example.com',
      first_name: 'Spam',
      last_name: 'Account',
      role: Role.user,
      status: UserStatus.banned,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Permanently banned spam account.',
      city: 'Unknown',
      birth_date: new Date('1999-01-01'),
      avatar_url: null,
      banned_until: null,
    },
    {
      key: 'temp_banned_user',
      username: 'marco_tempban',
      email: 'tempban@example.com',
      first_name: 'Marco',
      last_name: 'Sospeso',
      role: Role.user,
      status: UserStatus.banned,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Repeat offender currently serving a 30-day temporary suspension.',
      city: 'Verona',
      birth_date: new Date('1994-07-07'),
      avatar_url: null,
      banned_until: new Date(now.getTime() + 30 * DAY_MS),
    },
    {
      key: 'repeat_offender_active',
      username: 'paolo_repeat',
      email: 'paolo.repeat@example.com',
      first_name: 'Paolo',
      last_name: 'Conti',
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: ProfilePrivacy.public,
      bio: 'Active user with prior resolved warnings and an expired ban.',
      city: 'Padova',
      birth_date: new Date('1990-11-25'),
      avatar_url: null,
      banned_until: null,
    },
  ];

  const cities = [
    'Firenze',
    'Roma',
    'Milano',
    'Torino',
    'Napoli',
    'Bologna',
    'Venezia',
    'Palermo',
    'Paris',
    'Lyon',
    'Nice',
    'Barcelona',
    'Berlin',
    'Vienna',
    'Lisbon',
  ];
  const privacyCycle: ProfilePrivacy[] = [
    ProfilePrivacy.public,
    ProfilePrivacy.friends_only,
    ProfilePrivacy.private,
  ];

  const extraUsers: SeedUserFixture[] = [];
  for (let i = 1; i <= 15; i++) {
    const idx = i.toString().padStart(2, '0');
    const privacy = privacyCycle[(i - 1) % privacyCycle.length];
    extraUsers.push({
      key: `demo_cook_${idx}`,
      username: `demo_cook_${idx}`,
      email: `demo.cook.${idx}@example.com`,
      first_name: `Chef`,
      last_name: `Demo${idx}`,
      role: Role.user,
      status: UserStatus.active,
      profile_privacy: privacy,
      bio: `Passionate home cook #${idx} sharing everyday favorites.`,
      city: cities[(i - 1) % cities.length],
      birth_date: new Date(1985 + (i % 15), (i * 2) % 12, ((i * 5) % 27) + 1),
      avatar_url: null,
    });
  }

  return [...baselineUsers, ...extraUsers];
}
