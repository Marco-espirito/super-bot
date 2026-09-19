import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL n’est pas configurée.");

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(schema);
  console.log("Schéma PostgreSQL et pgvector appliqués avec succès.");
} finally {
  await client.end();
}
