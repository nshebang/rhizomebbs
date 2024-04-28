export class Blotter {
  constructor(db) {
    this.db = db;
  }

  async addBlotterPost(post) {
    let blotter = await this.db.get('blotter') ?? [];
    blotter.push(post);
    await this.db.set('blotter', blotter);
  }

  async getAllBlotterPosts() {
    const blotter = await this.db.get('blotter') ?? [];
    return [ ...blotter ].sort((a, b) => b.timestamp - a.timestamp);
  }

  async deleteBlotterPost(id) {
    const posts = await this.db.get('blotter') ?? [];
    const newPosts = [...posts].filter(p => p.timestamp !== id);
    await this.db.set('blotter', newPosts);
  }
}
