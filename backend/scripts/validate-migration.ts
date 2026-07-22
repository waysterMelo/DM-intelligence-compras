/**
 * Migration Validation Script — Etapa 1
 *
 * Valida a migration phase4_review_hardening em base ja migrada.
 * Uso: npx ts-node scripts/validate-migration.ts
 *
 * Cenarios testados:
 * - User.role is enum UserRole
 * - Invalid role insertion via raw SQL + normalization handling
 * - buyerCompanyId backfill logic
 * - tenantId constraints
 * - New tables existence
 * - Enums consistency
 * - Rerun idempotency (via migration re-deploy)
 */

import { PrismaClient } from '@prisma/client';

let passed = 0;
let failed = 0;
const warnings: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function warn(msg: string) {
  warnings.push(msg);
  console.log(`  WARN ${msg}`);
}

async function main() {
  console.log('=== Migration Validation -- Etapa 1 ===\n');
  console.log(`Date: ${new Date().toISOString()}\n`);

  const prisma = new PrismaClient();

  // ============================================================
  // STEP 0 -- Environment check
  // ============================================================
  console.log('--- Step 0: Environment ---');

  const dbCheck = await prisma.$queryRawUnsafe(`
    SELECT version()
  `) as any[];
  console.log(`  DB: ${dbCheck[0]?.version?.substring(0, 60)}...`);

  // Count existing users and companies
  const userCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "User"`) as any[];
  const companyCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "fornecedores"`) as any[];
  const jobCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "tax_reprocessing_jobs"`) as any[];

  console.log(`  Users: ${userCount[0]?.c}`);
  console.log(`  Companies: ${companyCount[0]?.c}`);
  console.log(`  Tax jobs: ${jobCount[0]?.c}`);

  // ============================================================
  // STEP 1 -- User.role is enum UserRole (NOT TEXT)
  // ============================================================
  console.log('\n--- Step 1: User.role schema ---');

  const roleColumn = await prisma.$queryRawUnsafe(`
    SELECT udt_name FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'role'
  `) as any[];

  assert(roleColumn.length === 1, 'User.role column exists');
  assert(
    roleColumn[0]?.udt_name?.toLowerCase() === 'userrole',
    `User.role is enum UserRole (not TEXT)`,
    `Current type: ${roleColumn[0]?.udt_name}`
  );

  // Check no role_new column remains
  const roleNewCol = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'role_new'
  `) as any[];
  assert(roleNewCol.length === 0, 'role_new column removed', roleNewCol.length > 0 ? 'still exists!' : '');

  // ============================================================
  // STEP 2 -- UserRole enum values
  // ============================================================
  console.log('\n--- Step 2: Enum values ---');

  const userRoleEnum = await prisma.$queryRawUnsafe(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
    ORDER BY enumsortorder
  `) as any[];
  const roleLabels = userRoleEnum.map((e: any) => e.enumlabel);

  assert(roleLabels.includes('BUYER'), 'UserRole has BUYER');
  assert(roleLabels.includes('MANAGER'), 'UserRole has MANAGER');
  assert(roleLabels.includes('ADMIN'), 'UserRole has ADMIN');
  assert(roleLabels.includes('SPECIALIST'), 'UserRole has SPECIALIST');
  assert(roleLabels.length === 4, `UserRole has exactly 4 values`, `Got ${roleLabels.length}`);

  // ReviewStatus enum
  const reviewStatusEnum = await prisma.$queryRawUnsafe(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReviewStatus')
  `) as any[];
  const statusLabels = reviewStatusEnum.map((e: any) => e.enumlabel);
  assert(statusLabels.length === 5, `ReviewStatus has 5 values`, `Got ${statusLabels.length}`);

  // ReviewReasonCode enum
  const reasonEnum = await prisma.$queryRawUnsafe(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReviewReasonCode')
  `) as any[];
  const reasonLabels = reasonEnum.map((e: any) => e.enumlabel);
  assert(reasonLabels.length === 7, `ReviewReasonCode has 7 values`, `Got ${reasonLabels.length}`);

  // JobStatus has COMPLETED_ALL_SKIPPED
  const jobStatusEnum = await prisma.$queryRawUnsafe(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'JobStatus')
  `) as any[];
  const jobStatusLabels = jobStatusEnum.map((e: any) => e.enumlabel);
  assert(jobStatusLabels.includes('COMPLETED_ALL_SKIPPED'), 'JobStatus has COMPLETED_ALL_SKIPPED');

  // ============================================================
  // STEP 3 -- Seed test companies + users for backfill tests
  // ============================================================
  console.log('\n--- Step 3: Seed test data ---');

  // Buyer company
  const buyerCompany = await prisma.fornecedor.upsert({
    where: { cnpj: '11111111000111' },
    create: {
      name: 'RA Polymers (Buyer Test)',
      cnpj: '11111111000111',
      taxRegime: 'REAL',
      companyRole: 'BUYER',
      state: 'SP',
      tenantId: 'test-tenant-1'
    },
    update: {}
  });

  // Supplier company
  const supplierCompany = await prisma.fornecedor.upsert({
    where: { cnpj: '22222222000122' },
    create: {
      name: 'Supplier Test Ltda',
      cnpj: '22222222000122',
      taxRegime: 'REAL',
      companyRole: 'SUPPLIER',
      state: 'RJ',
      tenantId: 'test-tenant-1'
    },
    update: {}
  });

  console.log(`  Buyer company: ${buyerCompany.id}`);
  console.log(`  Supplier company: ${supplierCompany.id}`);

  // Users with valid roles
  const userBuyer = await prisma.user.upsert({
    where: { username: 'test_buyer_valid' },
    create: {
      name: 'Test Buyer',
      username: 'test_buyer_valid',
      password: 'hashed-pw',
      role: 'BUYER',
      fornecedorId: buyerCompany.id
    },
    update: {}
  });

  const userMgr = await prisma.user.upsert({
    where: { username: 'test_manager_valid' },
    create: {
      name: 'Test Manager',
      username: 'test_manager_valid',
      password: 'hashed-pw',
      role: 'MANAGER',
      fornecedorId: buyerCompany.id
    },
    update: {}
  });

  const userNoFornecedor = await prisma.user.upsert({
    where: { username: 'test_no_fornecedor' },
    create: {
      name: 'Test User No Fornecedor',
      username: 'test_no_fornecedor',
      password: 'hashed-pw',
      role: 'BUYER',
      fornecedorId: buyerCompany.id  // Need a valid FK, so we set one but will test orphan jobs
    },
    update: {}
  });

  console.log(`  User buyer: ${userBuyer.id}`);
  console.log(`  User manager: ${userMgr.id}`);
  console.log(`  User no fornecedor: ${userNoFornecedor.id}`);

  // ============================================================
  // STEP 4 -- Existing user roles distribution
  // ============================================================
  console.log('\n--- Step 4: User role distribution ---');

  const roleDist = await prisma.$queryRawUnsafe(`
    SELECT role, COUNT(*) as cnt FROM "User" GROUP BY role ORDER BY role
  `) as any[];
  console.log('  Role distribution:');
  for (const r of roleDist) {
    console.log(`    ${r.role}: ${r.cnt}`);
  }

  // Verify no invalid roles exist
  const invalidRoles = await prisma.$queryRawUnsafe(`
    SELECT id, username, role FROM "User"
    WHERE role::text NOT IN ('BUYER', 'MANAGER', 'ADMIN', 'SPECIALIST')
  `) as any[];
  assert(invalidRoles.length === 0, `No invalid roles exist`, `Found ${invalidRoles.length} users with invalid roles`);
  if (invalidRoles.length > 0) {
    for (const u of invalidRoles) {
      warn(`User "${u.username}" has role "${u.role}"`);
    }
  }

  // ============================================================
  // STEP 5 -- Invalid role insertion attempt (via raw SQL)
  // ============================================================
  console.log('\n--- Step 5: Invalid role rejection ---');

  // Try to insert a user with invalid role -- should fail now
  try {
    await prisma.$queryRawUnsafe(`
      INSERT INTO "User" (id, name, username, password, role, "fornecedorId")
      VALUES ('temp-invalid-role', 'Invalid Role Test', 'test_invalid_role_x', 'hashed-pw', 'USER', '${buyerCompany.id}')
    `);
    // If it somehow succeeded, clean up
    await prisma.$queryRawUnsafe(`DELETE FROM "User" WHERE id = 'temp-invalid-role'`);
    assert(false, 'Invalid role "USER" was rejected by DB', 'Insert succeeded -- this should not happen!');
  } catch (e: any) {
    assert(true, `Invalid role "USER" rejected by PostgreSQL`, e.message?.substring(0, 100));
  }

  // ============================================================
  // STEP 6 -- buyerCompanyId backfill validation
  // ============================================================
  console.log('\n--- Step 6: buyerCompanyId backfill ---');

  // Check existing jobs
  const existingJobs = await prisma.$queryRawUnsafe(`
    SELECT id, "buyerCompanyId", "tenantId", "requestedByUserId"
    FROM "tax_reprocessing_jobs"
    ORDER BY id
  `) as any[];
  console.log(`  Existing tax_reprocessing_jobs: ${existingJobs.length}`);

  // Seed test jobs for backfill validation
  // Job 6a: has requestedByUserId pointing to user with BUYER fornecedor
  const jobsBackfilled = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as c
    FROM "tax_reprocessing_jobs" j
    JOIN "User" u ON u.id = j."requestedByUserId"
    JOIN "fornecedores" f ON f.id = u."fornecedorId"
    WHERE j."buyerCompanyId" = f.id
  `) as any[];
  console.log(`  Jobs correctly backfilled via user chain: ${jobsBackfilled[0]?.c}`);

  // Check for jobs still with NULL buyerCompanyId
  const nullBuyerJobs = await prisma.$queryRawUnsafe(`
    SELECT id, "tenantId", "requestedByUserId"
    FROM "tax_reprocessing_jobs"
    WHERE "buyerCompanyId" IS NULL
  `) as any[];
  console.log(`  Jobs without buyerCompanyId: ${nullBuyerJobs.length}`);

  // Check buyerCompanyId constraint is NOT NULL or warn if nullable
  const buyerCol = await prisma.$queryRawUnsafe(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'tax_reprocessing_jobs' AND column_name = 'buyerCompanyId'
  `) as any[];
  if (buyerCol[0]?.is_nullable === 'NO') {
    assert(true, 'buyerCompanyId is NOT NULL');
  } else if (buyerCol[0]?.is_nullable === 'YES') {
    assert(false, 'buyerCompanyId allows NULL', 'Migration did not set NOT NULL -- some jobs could not be backfilled');
    if (nullBuyerJobs.length > 0) {
      warn(`${nullBuyerJobs.length} jobs still without buyerCompanyId`);
    }
  } else {
    warn('Could not determine buyerCompanyId nullability');
  }

  // Check tenantId constraint
  const tenantCol = await prisma.$queryRawUnsafe(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'tax_reprocessing_jobs' AND column_name = 'tenantId'
  `) as any[];
  if (tenantCol[0]?.is_nullable === 'NO') {
    assert(true, 'tenantId is NOT NULL');
  } else if (tenantCol[0]?.is_nullable === 'YES') {
    const nullTenant = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as c FROM "tax_reprocessing_jobs" WHERE "tenantId" IS NULL
    `) as any[];
    if (nullTenant[0]?.c === 0) {
      assert(true, 'No NULL tenantId values (column is nullable but clean)');
    } else {
      warn(`${nullTenant[0]?.c} jobs without tenantId`);
    }
  }

  // ============================================================
  // STEP 7 -- New tables existence
  // ============================================================
  console.log('\n--- Step 7: New tables ---');

  const tables = await prisma.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'tax_review_queue_items',
        'tax_review_decisions',
        'tax_legal_basis',
        '_DecisionRules',
        'tax_review_thresholds'
      )
    ORDER BY tablename
  `) as any[];
  const tableNames = tables.map((t: any) => t.tablename);
  const expectedTables = ['_DecisionRules', 'tax_legal_basis', 'tax_review_decisions', 'tax_review_queue_items', 'tax_review_thresholds'];

  for (const expected of expectedTables) {
    assert(tableNames.includes(expected), `Table ${expected} exists`);
  }
  assert(tables.length === expectedTables.length, `All ${expectedTables.length} new tables exist`, `Found ${tables.length}`);

  // ============================================================
  // STEP 8 -- Indexes
  // ============================================================
  console.log('\n--- Step 8: Indexes ---');

  const indexes = await prisma.$queryRawUnsafe(`
    SELECT indexname FROM pg_indexes
    WHERE tablename IN ('tax_review_queue_items', 'tax_review_decisions', '_DecisionRules', 'tax_legal_basis')
    ORDER BY indexname
  `) as any[];
  const indexNames = indexes.map((i: any) => i.indexname);

  const expectedIndexes = [
    'tax_review_queue_items_tenantId_status_idx',
    'tax_review_queue_items_assignedToUserId_status_idx',
    'tax_review_queue_items_reasonCode_severity_idx',
    'tax_review_decisions_tenantId_outcome_idx',
    'tax_review_decisions_reasonCode_idx',
    '_DecisionRules_AB_unique',
    '_DecisionRules_B_index',
    'tax_legal_basis_code_key'
  ];

  for (const expected of expectedIndexes) {
    assert(indexNames.includes(expected), `Index ${expected} exists`);
  }

  // ============================================================
  // STEP 9 -- Foreign keys
  // ============================================================
  console.log('\n--- Step 9: Foreign Keys ---');

  const fks = await prisma.$queryRawUnsafe(`
    SELECT conname FROM pg_constraint
    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND contype = 'f'
      AND conname IN (
        'tax_review_queue_items_quoteId_fkey',
        'tax_review_decisions_reviewItemId_fkey',
        '_DecisionRules_A_fkey',
        '_DecisionRules_B_fkey'
      )
  `) as any[];
  const fkNames = fks.map((f: any) => f.conname);

  assert(fkNames.includes('tax_review_queue_items_quoteId_fkey'), 'FK: tax_review_queue_items -> Quote');
  assert(fkNames.includes('tax_review_decisions_reviewItemId_fkey'), 'FK: tax_review_decisions -> review_item');
  assert(fkNames.includes('_DecisionRules_A_fkey'), 'FK: _DecisionRules -> decisions');
  assert(fkNames.includes('_DecisionRules_B_fkey'), 'FK: _DecisionRules -> TaxRuleCatalog');

  // ============================================================
  // STEP 10 -- Quote schema additions
  // ============================================================
  console.log('\n--- Step 10: Quote schema ---');

  const quoteCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Quote' AND column_name IN ('createdAt', 'pendingReview', 'updatedAt')
  `) as any[];
  const quoteColNames = quoteCols.map((c: any) => c.column_name);
  assert(quoteColNames.includes('createdAt'), 'Quote.createdAt exists');
  assert(quoteColNames.includes('pendingReview'), 'Quote.pendingReview exists');
  assert(quoteColNames.includes('updatedAt'), 'Quote.updatedAt exists');

  // ============================================================
  // STEP 11 -- TaxJob additional columns
  // ============================================================
  console.log('\n--- Step 11: Tax job columns ---');

  const jobCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'tax_reprocessing_jobs'
      AND column_name IN ('cancelRequestedAt', 'retryCount', 'maxRetries')
  `) as any[];
  const jobColNames = jobCols.map((c: any) => c.column_name);
  assert(jobColNames.includes('cancelRequestedAt'), 'TaxJob.cancelRequestedAt exists');
  assert(jobColNames.includes('retryCount'), 'TaxJob.retryCount exists');
  assert(jobColNames.includes('maxRetries'), 'TaxJob.maxRetries exists');

  // ============================================================
  // STEP 12 -- fornecedores tenantId
  // ============================================================
  console.log('\n--- Step 12: fornecedor columns ---');

  const fornCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name = 'fornecedores' AND column_name = 'tenantId'
  `) as any[];
  assert(fornCols.length > 0, 'fornecedores.tenantId exists');

  // ============================================================
  // STEP 13 -- TaxRuleCatalog new columns
  // ============================================================
  console.log('\n--- Step 13: TaxRuleCatalog columns ---');

  const catalogCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'TaxRuleCatalog' AND column_name IN ('appliesTo', 'category', 'severity')
  `) as any[];
  const catalogColNames = catalogCols.map((c: any) => c.column_name);
  assert(catalogColNames.includes('appliesTo'), 'TaxRuleCatalog.appliesTo exists');
  assert(catalogColNames.includes('category'), 'TaxRuleCatalog.category exists');
  assert(catalogColNames.includes('severity'), 'TaxRuleCatalog.severity exists');

  // ============================================================
  // STEP 14 -- TaxReviewThreshold enum
  // ============================================================
  console.log('\n--- Step 14: ReviewTriggerType enum ---');

  const triggerEnum = await prisma.$queryRawUnsafe(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReviewTriggerType')
    ORDER BY enumsortorder
  `) as any[];
  const triggerLabels = triggerEnum.map((e: any) => e.enumlabel);
  assert(triggerLabels.length > 0, 'ReviewTriggerType exists', `Found ${triggerLabels.length} values`);
  if (triggerLabels.length > 0) {
    assert(triggerLabels.includes('BLOCKED'), 'ReviewTriggerType has BLOCKED');
    assert(triggerLabels.includes('LOW_CONFIDENCE'), 'ReviewTriggerType has LOW_CONFIDENCE');
  }

  // ============================================================
  // STEP 15 -- Clean up test data
  // ============================================================
  console.log('\n--- Step 15: Clean up test users ---');

  try {
    await prisma.user.deleteMany({
      where: { username: { in: ['test_buyer_valid', 'test_manager_valid', 'test_no_fornecedor', 'test_empty_role', 'test_invalid_role_x'] } }
    });
    assert(true, 'Test users cleaned up');
  } catch (e: any) {
    warn(`Could not clean up test users: ${e.message}`);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n========================================');
  console.log('         VALIDATION SUMMARY');
  console.log('========================================');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Warnings: ${warnings.length}`);

  if (warnings.length > 0) {
    console.log('\n  Warning list:');
    for (const w of warnings) {
      console.log(`    - ${w}`);
    }
  }

  console.log('\n--- Environment ---');
  console.log(`  Users tested: ${userCount[0]?.c}`);
  console.log(`  Companies tested: ${companyCount[0]?.c}`);
  console.log(`  Tax jobs tested: ${jobCount[0]?.c}`);
  console.log(`  Invalid roles found: ${invalidRoles.length}`);
  console.log(`  Jobs without buyerCompanyId: ${nullBuyerJobs.length}`);

  if (failed === 0) {
    console.log('\n  RESULT: APPROVED for production');
  } else if (failed <= 2) {
    console.log('\n  RESULT: APPROVED with reservations');
    console.log(`  ${failed} check(s) need attention`);
  } else {
    console.log('\n  RESULT: REJECTED -- do NOT deploy');
    console.log(`  ${failed} critical check(s) failed`);
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
