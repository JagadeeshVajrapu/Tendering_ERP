import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { User } from '../models/User';
import { seedUsers, DEFAULT_SEED_PASSWORD } from './data/users.seed';
import { UserRole } from '../types';

const args = process.argv.slice(2);
const shouldReset = args.includes('--reset') || args.includes('-r');

async function seedUsersToDatabase(): Promise<void> {
  await connectDatabase();

  if (shouldReset) {
    const emails = seedUsers.map((u) => u.email);
    const deleted = await User.deleteMany({ email: { $in: emails } });
    console.log(`\nReset: removed ${deleted.deletedCount} existing seed user(s).\n`);
  }

  let created = 0;
  let skipped = 0;

  for (const userData of seedUsers) {
    const existing = await User.findOne({ email: userData.email });

    if (existing && !shouldReset) {
      console.log(`  skip  ${userData.email} (${userData.role}) — already exists`);
      skipped++;
      continue;
    }

    if (existing && shouldReset) {
      await User.deleteOne({ _id: existing._id });
    }

    await User.create(userData);
    console.log(`  added ${userData.email} (${userData.role}) — ${userData.name}`);
    created++;
  }

  // Ensure role counts
  const counts = await User.aggregate<{ _id: UserRole; count: number }>([
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ]);

  console.log('\n--- Seed summary ---');
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped}`);
  console.log('\n  Users by role:');
  counts.forEach((c) => console.log(`    ${c._id}: ${c.count}`));

  console.log('\n--- Login credentials (password for all: ' + DEFAULT_SEED_PASSWORD + ') ---');
  console.log('  Role       | Email                      | Name');
  console.log('  -----------|----------------------------|------------------');
  seedUsers.forEach((u) => {
    const role = u.role.padEnd(10);
    const email = u.email.padEnd(26);
    console.log(`  ${role} | ${email} | ${u.name}`);
  });

  await mongoose.disconnect();
  console.log('\nSeed complete.\n');
}

seedUsersToDatabase().catch((err: Error & { code?: number; codeName?: string }) => {
  console.error('\nSeed failed:', err.message);

  if (err.code === 8000 || err.codeName === 'AtlasError' || /authentication failed/i.test(err.message)) {
    console.error(`
MongoDB authentication failed. Common fixes:
  1. Local dev: run "docker-compose up -d" from project root, then set:
     MONGODB_URI=mongodb://localhost:27017/tender-erp
  2. Atlas: reset the DB user password in Atlas → Database Access,
     then update MONGODB_URI (URL-encode @ as %40, # as %23, etc.)
  3. Atlas: Network Access → allow your IP (or 0.0.0.0/0 for testing)
`);
  }

  process.exit(1);
});
