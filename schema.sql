CREATE TABLE IF NOT EXISTS posts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    number INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    lastBump INTEGER NOT NULL,
    lastReply INTEGER NOT NULL,
    sage BOOLEAN NOT NULL,
    capcode BOOLEAN NOT NULL,
    enableIds BOOLEAN NOT NULL,
    closed BOOLEAN NOT NULL,
    replyCount INTEGER NOT NULL,
    ip TEXT NOT NULL,
    parent INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
    board,
    title,
    content,
    content_rowid=parent,
    tokenize='unicode61'
);

CREATE TABLE IF NOT EXISTS bans(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    reason TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    author TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blotter(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL
);
