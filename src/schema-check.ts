import dataSource from './data-source';

interface InfoColumn {
  COLUMN_NAME?: string;
  column_name?: string;
}

async function run(): Promise<void> {
  await dataSource.initialize();
  const problems: string[] = [];

  for (const meta of dataSource.entityMetadatas) {
    const table = meta.tableName;
    const rows: InfoColumn[] = await dataSource.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
      [table],
    );
    if (rows.length === 0) {
      problems.push(`MISSING TABLE for entity ${meta.name}: \`${table}\``);
      continue;
    }
    const dbColumns = new Set(rows.map((r) => r.COLUMN_NAME ?? r.column_name));
    for (const column of meta.columns) {
      if (!dbColumns.has(column.databaseName)) {
        problems.push(
          `MISSING COLUMN ${table}.${column.databaseName} (entity ${meta.name}.${column.propertyName})`,
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error(
      `SCHEMA DRIFT — ${problems.length} problem(s); entities expect schema the DB does not have:`,
    );
    for (const problem of problems) console.error('  ' + problem);
    await dataSource.destroy();
    process.exit(1);
  }

  console.log(
    `Schema OK — ${dataSource.entityMetadatas.length} entities verified; all tables + columns present.`,
  );
  await dataSource.destroy();
}

run().catch(async (error) => {
  console.error(error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
