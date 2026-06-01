import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

export const db = new Database(process.env.DATABASE_PATH || "");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
