#!/usr/bin/env node
/*
  Migration script to consolidate legacy `restaurant_tables` and `tables`
  into admin `fb_tables` (idempotent). Usage:

    node scripts/migrate_tables_to_fb_tables.js --dry-run
    node scripts/migrate_tables_to_fb_tables.js

  Dry-run will only print planned inserts without performing them.
*/

const db = require('../config/db');
const FbTable = require('../models/fbTableModel');
const FbTableGroup = require('../models/fbTableGroupModel');

const q = (sql, params = []) =>
  new Promise((resolve, reject) => db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

const normalizeTableNumber = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  const prefixed = raw.match(/^([A-Z]+)0+(\d+)$/);
  if (prefixed) return `${prefixed[1]}${prefixed[2]}`;
  if (/^\d+$/.test(raw)) return String(Number(raw));
  return raw;
};

const normalizeSectionName = (v) => String(v || '').trim().toUpperCase();

const getCanonicalFbTableName = (number, sectionName = '') => {
  const normalizedNumber = normalizeTableNumber(number);
  if (!normalizedNumber) return '';
  if (/^[TGPR]\d+$/.test(normalizedNumber)) return normalizedNumber;
  const section = normalizeSectionName(sectionName);
  const plain = normalizedNumber.replace(/^0+/, '') || '0';
  if (section === 'GARDEN') return `G${plain}`;
  if (section === 'PARSAL') return `P${plain}`;
  if (section === 'ROOM DINING') return `R${plain}`;
  return `T${plain}`;
};

const getFbTableGroupId = async (sectionName = '') => {
  const section = normalizeSectionName(sectionName);
  if (!section) return null;
  try {
    await FbTableGroup.ensureSchema();
    const rows = await q('SELECT id FROM fb_table_groups WHERE UPPER(name) = ? LIMIT 1', [section]);
    return rows?.[0]?.id || null;
  } catch (e) {
    return null;
  }
};

const main = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');

  console.log(`Migration started (${dryRun ? 'dry-run' : 'apply'})`);
  await FbTableGroup.ensureSchema();
  await FbTable.ensureSchema();

  const existingFb = await FbTable.list();
  const existingMap = new Map(existingFb.map((r) => [normalizeTableNumber(r.name).toLowerCase(), r]));

  const sources = [];
  try {
    const rows = await q('SELECT * FROM restaurant_tables');
    sources.push({ name: 'restaurant_tables', rows });
  } catch (e) {
    // no-op
  }
  try {
    const rows = await q('SELECT * FROM tables');
    sources.push({ name: 'tables (legacy)', rows });
  } catch (e) {
    // no-op
  }

  const planned = [];
  for (const source of sources) {
    for (const row of source.rows) {
      const rawNumber = row.number || row.table_number || row.name || '';
      const section = row.section_name || row.section || row.table_group_name || '';
      const canonical = getCanonicalFbTableName(rawNumber, section);
      if (!canonical) continue;
      const key = normalizeTableNumber(canonical).toLowerCase();
      if (existingMap.has(key)) continue;

      planned.push({ source: source.name, row, canonical });
      if (!dryRun) {
        const groupId = await getFbTableGroupId(section);
        const capacity = Number(row.seat_count || row.seatCount || row.capacity || 4) || 4;
        try {
          const created = await FbTable.create({ table_group_id: groupId, name: canonical, capacity, status: 'available', is_active: 1 });
          existingMap.set(key, created);
          console.log(`Inserted: ${canonical} (id=${created.id}) from ${source.name}`);
        } catch (err) {
          console.error(`FAILED to create ${canonical}:`, err.message || err.sqlMessage || err);
        }
      }
    }
  }

  if (dryRun) {
    console.log('\nDry-run summary: planned inserts:', planned.length);
    for (const p of planned) console.log(`- ${p.canonical} (from ${p.source})`);
  } else {
    console.log(`\nApplied migration, new tables created: ${planned.length}`);
  }
  console.log('Done.');
  process.exit(0);
};

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
