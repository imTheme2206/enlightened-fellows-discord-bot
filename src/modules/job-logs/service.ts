import { randomUUID } from "crypto";
import { db } from "../../db/client";

export abstract class JobLogService {
  static log(jobName: string, status: string, message?: string): void {
    db.prepare(
      "INSERT INTO JobLog (id, jobName, status, message) VALUES (?, ?, ?, ?)",
    ).run(randomUUID(), jobName, status, message ?? null);
  }

  static getRecent(limit = 20) {
    return db
      .prepare("SELECT * FROM JobLog ORDER BY createdAt DESC LIMIT ?")
      .all(limit);
  }
}
