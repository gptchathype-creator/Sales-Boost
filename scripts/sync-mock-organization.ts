import { syncMockOrganization } from '../src/auth/organizationManagement';

async function main() {
  const summary = await syncMockOrganization();
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('Failed to sync mock organization:', error);
    process.exitCode = 1;
  });
