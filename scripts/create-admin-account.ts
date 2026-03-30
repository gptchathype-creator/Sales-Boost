import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

const prisma = new PrismaClient();

async function main() {
  const [, , emailArg, passwordArg, displayNameArg] = process.argv;
  const email = (emailArg || '').trim().toLowerCase();
  const password = passwordArg || '';
  const displayName = (displayNameArg || 'Admin').trim();

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-admin-account.ts <email> <password> [displayName]');
    process.exit(1);
  }

  const account = await prisma.account.upsert({
    where: { email },
    update: {
      passwordHash: hashPassword(password),
      displayName,
      status: 'active',
    },
    create: {
      email,
      passwordHash: hashPassword(password),
      displayName,
      status: 'active',
      memberships: {
        create: {
          role: 'platform_superadmin',
        },
      },
    },
    include: {
      memberships: true,
    },
  });

  const hasSuperadmin = account.memberships.some((membership) => membership.role === 'platform_superadmin');
  if (!hasSuperadmin) {
    await prisma.accountMembership.create({
      data: {
        accountId: account.id,
        role: 'platform_superadmin',
      },
    });
  }

  console.log(`Admin account ready: ${account.email}`);
}

main()
  .catch((error) => {
    console.error('Failed to create admin account:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
