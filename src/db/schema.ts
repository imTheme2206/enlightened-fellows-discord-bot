import { db } from './client'

// Detect stale schema by checking for a column that only exists in the new schema.
// If missing, drop all tables so CREATE TABLE IF NOT EXISTS rebuilds them correctly.
const decoColumns = (db.prepare('PRAGMA table_info(Decoration)').all() as { name: string }[]).map((c) => c.name)

if (decoColumns.length > 0 && !decoColumns.includes('skillId')) {
  db.exec(`
    DROP TABLE IF EXISTS ArmorGroupSkill;
    DROP TABLE IF EXISTS ArmorSetSkill;
    DROP TABLE IF EXISTS ArmorSkill;
    DROP TABLE IF EXISTS Decoration;
    DROP TABLE IF EXISTS Armor;
    DROP TABLE IF EXISTS SkillRank;
    DROP TABLE IF EXISTS Skill;
    DROP TABLE IF EXISTS JobLog;
  `)
}

const genshinCodeColumns = (db.prepare('PRAGMA table_info(GenshinCode)').all() as { name: string }[]).map((c) => c.name)

if (genshinCodeColumns.length > 0 && !genshinCodeColumns.includes('rewards')) {
  db.exec('ALTER TABLE GenshinCode ADD COLUMN rewards TEXT')
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

  CREATE TABLE IF NOT EXISTS GenshinCode (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    rewards TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    isExpired INTEGER NOT NULL DEFAULT 0,
    isAlerted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS RegisteredChannel (
    channelId TEXT NOT NULL,
    type TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (channelId, type)
  );
`)

// Migrate legacy GenshinCodeChannel rows into RegisteredChannel
const legacyGenshinChannelTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='GenshinCodeChannel'").get()

if (legacyGenshinChannelTable) {
  db.exec(`
    INSERT OR IGNORE INTO RegisteredChannel (channelId, type, createdAt)
      SELECT channelId, 'genshin_code', createdAt FROM GenshinCodeChannel;
    DROP TABLE GenshinCodeChannel;
  `)
}
