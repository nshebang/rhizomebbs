export class BanManager {
  constructor(db) {
    this.db = db;
  }

  async addBan(ban) {
    let bans = await this.db.get('bans') ?? [];
    bans.push(ban);
    await this.db.set('bans', bans);
  }

  async getBan(ip) {
    const bans = await this.db.get('bans') ?? [];
    const result = bans.filter(b => b.ip === ip);
    return result.length > 0? result[0] : null;
  }

  async deleteBan(ip) {
    const bans = await this.db.get('bans') ?? [];
    const newBans = [...bans].filter(b => b.ip !== ip);
    await this.db.set('bans', newBans);
  }
}
