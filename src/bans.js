export class BanManager {
  constructor(db) {
    this.db = db;
  }

  addBan(ban) {
    this.db
      .prepare(`INSERT INTO bans (ip, reason, timestamp, expires, author)
        VALUES (?, ?, ?, ?, ?)`)
      .run(ban.ip, ban.reason, ban.timestamp, ban.expires, ban.author);
  }

  getBan(ip) {
    return this.db
      .prepare(`SELECT * FROM bans WHERE ip=?`)
      .get(ip);
  }

  deleteBan(ip) {
    this.db
      .prepare(`DELETE FROM bans WHERE ip=?`)
      .run(ip);
  }
}
