import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.DATABASE_PATH || "";

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Detect stale schema by checking for a column that only exists in the new schema.
// If missing, drop all tables so CREATE TABLE IF NOT EXISTS rebuilds them correctly.
const decoColumns = (
  db.prepare("PRAGMA table_info(Decoration)").all() as { name: string }[]
).map((c) => c.name);

if (decoColumns.length > 0 && !decoColumns.includes("skillId")) {
  db.exec(`
    DROP TABLE IF EXISTS ArmorGroupSkill;
    DROP TABLE IF EXISTS ArmorSetSkill;
    DROP TABLE IF EXISTS ArmorSkill;
    DROP TABLE IF EXISTS Decoration;
    DROP TABLE IF EXISTS Armor;
    DROP TABLE IF EXISTS SkillRank;
    DROP TABLE IF EXISTS Skill;
    DROP TABLE IF EXISTS JobLog;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS Skill (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    cleanName TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'armor',
    maxLevel INTEGER NOT NULL DEFAULT 1,
    isSetSkill INTEGER NOT NULL DEFAULT 0,
    isGroupSkill INTEGER NOT NULL DEFAULT 0,
    requiredPieces INTEGER,
    effectName TEXT
  );

  CREATE TABLE IF NOT EXISTS Decoration (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    slotSize INTEGER NOT NULL,
    skillId TEXT NOT NULL,
    skillLevel INTEGER NOT NULL,
    FOREIGN KEY (skillId) REFERENCES Skill(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Armor (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    rank TEXT NOT NULL DEFAULT 'HIGH',
    rarity INTEGER NOT NULL DEFAULT 0,
    defense INTEGER NOT NULL DEFAULT 0,
    fireRes INTEGER NOT NULL DEFAULT 0,
    waterRes INTEGER NOT NULL DEFAULT 0,
    thunderRes INTEGER NOT NULL DEFAULT 0,
    iceRes INTEGER NOT NULL DEFAULT 0,
    dragonRes INTEGER NOT NULL DEFAULT 0,
    slots TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS ArmorSkill (
    armorId TEXT NOT NULL,
    skillId TEXT NOT NULL,
    level INTEGER NOT NULL,
    PRIMARY KEY (armorId, skillId),
    FOREIGN KEY (armorId) REFERENCES Armor(id) ON DELETE CASCADE,
    FOREIGN KEY (skillId) REFERENCES Skill(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ArmorSetSkill (
    armorId TEXT NOT NULL,
    skillId TEXT NOT NULL,
    PRIMARY KEY (armorId, skillId),
    FOREIGN KEY (armorId) REFERENCES Armor(id) ON DELETE CASCADE,
    FOREIGN KEY (skillId) REFERENCES Skill(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ArmorGroupSkill (
    armorId TEXT NOT NULL,
    skillId TEXT NOT NULL,
    PRIMARY KEY (armorId, skillId),
    FOREIGN KEY (armorId) REFERENCES Armor(id) ON DELETE CASCADE,
    FOREIGN KEY (skillId) REFERENCES Skill(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS JobLog (
    id TEXT PRIMARY KEY,
    jobName TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS SearchHistory (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    label TEXT NOT NULL,
    data TEXT NOT NULL,
    searchedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function logJob(
  jobName: string,
  status: string,
  message?: string,
): void {
  db.prepare(
    "INSERT INTO JobLog (id, jobName, status, message) VALUES (?, ?, ?, ?)",
  ).run(randomUUID(), jobName, status, message ?? null);
}

export function getRecentJobLogs(limit = 20) {
  return db
    .prepare("SELECT * FROM JobLog ORDER BY createdAt DESC LIMIT ?")
    .all(limit);
}

export function isDbEmpty(): boolean {
  const row = db.prepare("SELECT COUNT(*) as count FROM Armor").get() as {
    count: number;
  };
  return row.count === 0;
}

export interface SearchHistoryRow {
  id: string;
  userId: string;
  label: string;
  data: string;
  searchedAt: string;
}

export function saveSearchHistory(
  userId: string,
  label: string,
  data: string,
): void {
  const old = db
    .prepare(
      "SELECT id FROM SearchHistory WHERE userId = ? ORDER BY searchedAt DESC LIMIT -1 OFFSET 9",
    )
    .all(userId) as { id: string }[];

  if (old.length > 0) {
    const placeholders = old.map(() => "?").join(", ");
    db.prepare(`DELETE FROM SearchHistory WHERE id IN (${placeholders})`).run(
      ...old.map((r) => r.id),
    );
  }

  db.prepare(
    "INSERT INTO SearchHistory (id, userId, label, data) VALUES (?, ?, ?, ?)",
  ).run(randomUUID(), userId, label, data);
}

export function getRecentSearchHistory(
  userId: string,
  limit = 10,
): SearchHistoryRow[] {
  return db
    .prepare(
      "SELECT * FROM SearchHistory WHERE userId = ? ORDER BY searchedAt DESC LIMIT ?",
    )
    .all(userId, limit) as SearchHistoryRow[];
}
