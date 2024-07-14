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
    parent UNINDEXED,
    timestamp UNINDEXED,
    number UNINDEXED,
    tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts
BEGIN
    INSERT INTO posts_fts (rowid, board, title, content, parent, timestamp, number)
    VALUES (
        new.id,
        new.board,
        new.title,
        new.content,
        new.parent,
        new.timestamp,
        new.number
    );
END;

CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts
BEGIN
    DELETE FROM posts_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts
BEGIN
    UPDATE posts_fts
    SET board = new.board,
        title = new.title,
        content = new.content,
        parent = new.parent,
        timestamp = new.timestamp,
        number = new.number
    WHERE rowid = old.id;
END;

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
