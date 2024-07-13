export class Blotter {
  constructor(db) {
    this.db = db;
  }

  addBlotterPost(post) {
    this.db
      .prepare(`INSERT INTO blotter (timestamp, author, content)
        VALUES (?, ?, ?)`)
      .run(post.timestamp, post.author, post.content);
  }

  getAllBlotterPosts() {
    return this.db
      .prepare(`SELECT * FROM blotter ORDER BY timestamp DESC`)
      .all();
  }

  deleteBlotterPost(id) {
    this.db
      .prepare(`DELETE FROM blotter WHERE timestamp=?`)
      .run(id);
  }
}
