import fs from 'fs/promises';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!databaseUrl) {
  console.error('ERROR: set DATABASE_URL or SUPABASE_DB_URL (Postgres connection string with sufficient privileges)');
  process.exit(1);
}

const outDir = path.resolve(process.cwd(), 'docs');
const today = new Date().toISOString().slice(0, 10);
const datedFile = path.join(outDir, `supabase_inspection_results_${today}.json`);
const latestFile = path.join(outDir, `supabase_inspection_results_latest.json`);
const previousFile = path.join(outDir, `supabase_inspection_results_previous.json`);

const client = new Client({ connectionString: databaseUrl });

/**
 * Lista todas as tabelas no schema `public`.
 * @returns {Promise<string[]>}
 */
const listTables = async () => {
  const res = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type='BASE TABLE' ORDER BY table_name;`
  );
  return res.rows.map((r) => r.table_name);
};

/**
 * Retorna colunas de uma tabela.
 * @param {string} table
 * @returns {Promise<object[]>}
 */
const getColumns = async (table) => {
  const res = await client.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name = $1
     ORDER BY ordinal_position;`,
    [table]
  );
  return res.rows;
};

/**
 * Retorna chaves primárias de uma tabela.
 * @param {string} table
 * @returns {Promise<string[]>}
 */
const getPrimaryKeys = async (table) => {
  const res = await client.query(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_schema='public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY';`,
    [table]
  );
  return res.rows.map((r) => r.column_name);
};

/**
 * Retorna foreign keys de uma tabela.
 * @param {string} table
 * @returns {Promise<object[]>}
 */
const getForeignKeys = async (table) => {
  const res = await client.query(
    `SELECT
       kcu.column_name,
       ccu.table_schema AS foreign_table_schema,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name=$1;`,
    [table]
  );
  return res.rows;
};

/**
 * Retorna índices da tabela.
 * @param {string} table
 * @returns {Promise<object[]>}
 */
const getIndexes = async (table) => {
  const res = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1;`,
    [table]
  );
  return res.rows;
};

/**
 * Gera snapshot do schema e escreve arquivos em `docs/`.
 */
const inspect = async () => {
  const tables = await listTables();
  const result = { generated_at: new Date().toISOString(), tables: {} };

  for (const tableName of tables) {
    const [columns, pks, fks, indexes] = await Promise.all([
      getColumns(tableName),
      getPrimaryKeys(tableName),
      getForeignKeys(tableName),
      getIndexes(tableName),
    ]);
    result.tables[tableName] = { columns, primary_keys: pks, foreign_keys: fks, indexes };
  }

  await fs.mkdir(outDir, { recursive: true });

  // keep previous latest as backup if exists
  try {
    await fs.access(latestFile);
    await fs.rename(latestFile, previousFile);
  } catch (err) {
    // ignore when latestFile does not exist
  }

  await fs.writeFile(datedFile, JSON.stringify(result, null, 2), 'utf8');
  await fs.writeFile(latestFile, JSON.stringify(result, null, 2), 'utf8');
  console.log('Wrote schema snapshot to', datedFile);
  console.log('Latest snapshot written to', latestFile);
};

/**
 * Entrypoint
 */
const main = async () => {
  try {
    await client.connect();
    await inspect();
  } catch (err) {
    console.error('Failed to inspect schema:', err && err.message ? err.message : err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
};

await main();
