import crypto from 'crypto';

export class PostManager {
  constructor(db) {
    this.db = db;
  }

  addPost(board, post) {
    if (post.parent !== 0) {
      let pthread = this.getThread(board, post.parent);
      if (pthread) {
        if (!post.sage)
          pthread.lastBump = post.timestamp;
        pthread.lastReply = post.timestamp;
        pthread.replyCount++;
        pthread.closed = (pthread.replyCount >= 999);
  
        this.db
          .prepare(`UPDATE posts
            SET lastBump=?, lastReply=?, closed=?, replyCount=?
            WHERE id=?`)
          .run(
            pthread.lastBump,
            pthread.lastReply,
            pthread.closed ? 1 : 0,
            pthread.replyCount,
            pthread.id
          );
      }
    } else {
      let threads = this.getThreads(board);
      if (threads.length >= 499) {
        threads.sort((a, b) => b.lastBump - a.lastBump);
        const threadsToDelete = threads.slice(499);
        threadsToDelete.forEach(thread => {
          this.deletePost(board, thread.timestamp);
        });
      }
    }

    let enableIds = false;

    if (post.parent !== 0) {
      const pthread = this.getThread(board, post.parent);
      post.number = pthread.replyCount;
      enableIds = pthread.enableIds;
    } else {
      enableIds = post.enableIds;
    }

    if (enableIds) {
      const threadIdentifier = post.parent === 0 ? `${post.timestamp}` : `${post.parent}`;
      post.userId = crypto.createHash('md5')
        .update(post.ip + threadIdentifier)
        .digest('hex')
        .slice(-8);
    }

    this.db
      .prepare(`INSERT INTO posts (board, timestamp, number,
        userId, lastBump, lastReply, sage, capcode, enableIds, closed,
        replyCount, ip, parent, title, content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        board,
        post.timestamp,
        post.number || 0,
        post.userId || '',
        post.lastBump || 0,
        post.lastReply || 0,
        post.sage ? 1 : 0,
        post.capcode ? 1 : 0,
        post.enableIds ? 1 : 0,
        post.closed ? 1 : 0,
        post.replyCount || 0,
        post.ip || '',
        post.parent || 0,
        post.title || '',
        post.content || ''
      );
  }

  deletePost(board, threadId, number = 0) {
    if (!number) {
      this.db
        .prepare(`DELETE FROM posts WHERE board=? AND (timestamp=? OR parent=?)`)
        .run(board, threadId, threadId);
    } else {
      this.db
        .prepare(`DELETE FROM posts WHERE board=? AND parent=? AND number=?`)
        .run(board, threadId, number);
    }
  }

  deletePostsByIp(_board, ip) {
    this.db
      .prepare(`DELETE FROM posts WHERE ip=?`)
      .run(ip);
  }

  getLastNGlobalPosts(limit = 10) {
    return this.db
      .prepare(`SELECT * FROM posts
        ORDER BY timestamp DESC LIMIT ?`)
      .all(limit);
  }

  getPosts(board, parent = 0) {
    return this.db
      .prepare(`SELECT * FROM posts WHERE board=? AND parent=?`)
      .all(board, parent);
  }

  getThreads(board) {
    return this.getPosts(board, 0);
  }

  getThreadsByBumpOrder(board) {
    const threads = this.getThreads(board);
    return [...threads]
      .sort((a, b) => b.lastBump - a.lastBump);
  }

  getLastNThreads(board, n) {
    const threads = this.getThreads(board);
    return [...threads]
      .sort((a, b) => b.lastBump - a.lastBump)
      .slice(0, n);
  }

  getLastNReplies(board, parent, n = 50) {
    const replies = this.getPosts(board, parent);
    return [...replies]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, n)
      .reverse();
  }

  getAllReplies(board, parent) {
    const replies = this.getPosts(board, parent);
    return [...replies]
      .sort((a, b) => b.timestamp - a.timestamp)
      .reverse();
  }

  getThread(board, threadId) {
    return this.db
      .prepare(`SELECT * FROM posts WHERE board=? AND timestamp=? AND parent=0`)
      .get(board, threadId);
  }

  closeThread(board, threadId) {
    this.db
      .prepare(`UPDATE posts
        SET closed=1
        WHERE board=? AND timestamp=? AND parent=0`)
      .run(board, threadId);
  }

  getPostByIds(board, threadId, number) {
    if (number === 1)
      return this.getThread(board, threadId);
    return this.db
      .prepare(`SELECT * FROM posts WHERE board=? AND parent=? AND number=?`)
      .get(board, threadId, number - 1);
  }
}
