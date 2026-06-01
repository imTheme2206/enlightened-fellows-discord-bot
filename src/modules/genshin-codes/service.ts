import { randomUUID } from "crypto";
import { db } from "../../db/client";

export interface GenshinCodeRow {
  id: string;
  code: string;
  rewards: string | null;
  createdAt: string;
  isExpired: number;
  isAlerted: number;
}

export abstract class GenshinCodeService {
  static save(
    code: string,
    isAlerted = false,
    isExpired = false,
    rewards?: string,
  ): void {
    db.prepare(
      "INSERT OR IGNORE INTO GenshinCode (id, code, rewards, isAlerted, isExpired) VALUES (?, ?, ?, ?, ?)",
    ).run(
      randomUUID(),
      code,
      rewards ?? null,
      isAlerted ? 1 : 0,
      isExpired ? 1 : 0,
    );
  }

  static getUnalerted(): GenshinCodeRow[] {
    return db
      .prepare(
        "SELECT * FROM GenshinCode WHERE isAlerted = 0 AND isExpired = 0 ORDER BY createdAt ASC",
      )
      .all() as GenshinCodeRow[];
  }

  static markAlerted(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    db.prepare(
      `UPDATE GenshinCode SET isAlerted = 1 WHERE id IN (${placeholders})`,
    ).run(...ids);
  }

  static getAll(limit = 100): GenshinCodeRow[] {
    return db
      .prepare("SELECT * FROM GenshinCode ORDER BY createdAt DESC LIMIT ?")
      .all(limit) as GenshinCodeRow[];
  }
}
