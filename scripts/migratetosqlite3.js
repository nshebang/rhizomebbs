/*
This script migrates pre-1.3 databases to the new sqlite3 schema
You don't need this script if you never installed any rhizomebbs
version before 1.3 on your server.
*/
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../schema.sql');
const oldDbPath = path.join(__dirname, '../json.sqlite'); // change if needed
const newDbPath = path.join(__dirname, '../bbs.sqlite3');

function migrateNewSchema(db) {
  const migration = fs.readFileSync(schemaPath, 'utf8');
  db.pragma('journal_mode = WAL');
  db.exec(migration);
}

function migrateBoards(db, odb) {
  const stmt = odb.prepare('SELECT * FROM json');
  const rows = stmt.all();

  rows.forEach(row => {
    const dataStr = row.ID === 'bans' || row.ID === 'blotter'?
      row.ID : `/${row.ID}`
    console.log(`Migrating ${dataStr}`);

    if (row.ID === 'bans') {
      migrateBans(db, row.json);
      return;
    }
    if (row.ID === 'blotter') {
      migrateBlotter(db, row.json);
      return;
    }
    
    const board = row.ID;
    const stmt2 = db.prepare(`INSERT INTO posts (board, timestamp, number,
      userId, lastBump, lastReply, sage, capcode, enableIds, closed,
      replyCount, ip, parent, title, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const posts = JSON.parse(row.json);
    
    posts.forEach(post => {
      console.log(`Migrate post ${dataStr}/${post.timestamp}#${post.number + 1}`);
      const result = stmt2.run(
        board,
        post.timestamp,
        post.number,
        post.userId,
        post.lastBump,
        post.lastReply,
        post.sage? 1 : 0,
        post.capcode? 1 : 0,
        post.enableIds? 1 : 0,
        post.closed? 1 : 0,
        post.replyCount,
        post.ip,
        post.parent,
        post.title,
        post.content
      );
      console.log(result);
    });
  });
}

function migrateBans(db, rawData) {
  const bans = JSON.parse(rawData);
  const stmt = db.prepare(`INSERT INTO bans (ip, reason, timestamp,
    expires, author)
    VALUES (?, ?, ?, ?, ?)`);
  
  bans.forEach(ban => {
    console.log(`Migrate ban ${ban.timestamp}`);
    const result = stmt.run(
      ban.ip,
      ban.reason,
      ban.timestamp,
      ban.expires,
      ban.author
    );
    console.log(result);
  });
}

function migrateBlotter(db, rawData) {
  const blotter = JSON.parse(rawData);
  const stmt = db.prepare(`INSERT INTO blotter (timestamp, author, content)
    VALUES (?, ?, ?)`);

  blotter.forEach(post => {
    console.log(`Migrate blotter post ${post.timestamp}`);
    const result = stmt.run(
      post.timestamp,
      post.username,
      post.content
    );
    console.log(result);
  });
}

(() => {
  if (!fs.existsSync(oldDbPath)) {
    console.log('No pre-1.3 database found.');
    process.exit(1);
  }

  const db = new Database(newDbPath);
  const odb = new Database(oldDbPath, { readonly: true });

  console.log('Migrating new schema');
  migrateNewSchema(db);
  console.log('Starting data migration');
  migrateBoards(db, odb);

  db.close();
  odb.close();

  console.log('---');
  console.log('Migration completed. You may get rid of the old json.sqlite ' +
    'file now. Or not. Whatever your decision is, it\'s no longer necessary.');
})();
