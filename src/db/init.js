import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDB() {
  if (process.env.NODE_ENV === "production") {
  console.log("Init skipped in production");
  return;
}

  const client = await pool.connect();

  try {
    console.log("🚀 Initializing database...");
    await client.query("BEGIN");

    /* =========================
       RUN SCHEMA ONLY
    ========================= */
    const schema = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf-8"
    );

    await client.query(schema);
    console.log("✅ Schema executed");

    await client.query("COMMIT");
    console.log("🎉 Database initialized successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Init failed:", err);
  } finally {
    client.release();
  }
}

export default initDB;


if (import.meta.url === `file://${process.argv[1]}`) {
  initDB();
}
