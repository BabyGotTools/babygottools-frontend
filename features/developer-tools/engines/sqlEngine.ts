/**
 * SQL formatting via sql-formatter. Never executes anything — string in,
 * string out.
 */

export type SqlDialect =
  | "postgresql"
  | "mysql"
  | "mariadb"
  | "sqlite"
  | "bigquery"
  | "snowflake"
  | "transactsql"
  | "plsql"
  | "spark"
  | "trino";

export const SQL_DIALECTS: { value: SqlDialect; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "mariadb", label: "MariaDB" },
  { value: "sqlite", label: "SQLite" },
  { value: "bigquery", label: "BigQuery" },
  { value: "snowflake", label: "Snowflake" },
  { value: "transactsql", label: "T-SQL" },
  { value: "plsql", label: "PL/SQL" },
  { value: "spark", label: "Spark SQL" },
  { value: "trino", label: "Trino" },
];

export interface SqlFormatOptions {
  dialect: SqlDialect;
  indent: 2 | 4;
  keywordCase: "preserve" | "upper" | "lower";
}

export async function formatSql(source: string, opts: SqlFormatOptions): Promise<string> {
  const mod = await import("sql-formatter");
  return mod.format(source, {
    language: opts.dialect,
    tabWidth: opts.indent,
    keywordCase: opts.keywordCase,
    expressionWidth: 88,
  });
}
