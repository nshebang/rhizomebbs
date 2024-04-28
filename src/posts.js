import crypto from 'crypto';

export class PostManager {
  constructor(db) {
    this.db = db;
  }

  async addPost(board, post) {
    let posts = await this.db.get(board) ?? [];
    let replyNumber = 0;
    let enableIds = post.parent === 0 && post.enableIds;
    let threadIdentifier = post.parent === 0? post.timestamp : 0;

    if (post.parent !== 0) {
      posts.forEach(t => {
        if (t.parent === 0 && t.timestamp === post.parent) {
          if (!post.sage)
            t.lastBump = post.timestamp;
          t.lastReply = post.timestamp;
          replyNumber = ++t.replyCount;
          t.closed = (replyNumber >= 999);
          enableIds = t.enableIds;
          threadIdentifier = t.timestamp;
        }
      });
    } else {
      const threads = posts.filter(thread => thread.parent === 0);
      const nonThreads = posts.filter(thread => thread.parent !== 0);
      if (threads.length >= 499) {
        threads.sort((a, b) => b.timestamp - a.timestamp);
        threads.splice(499);
        posts = [...threads, ...nonThreads];
      }
    }
    
    if (replyNumber)
      post.number = replyNumber;
    if (enableIds)
      post.userId = crypto.createHash('md5')
        .update(post.ip + threadIdentifier)
        .digest('hex')
        .slice(-8);
    posts.push(post);
    await this.db.set(board, posts);
  }

  async deletePost(board, threadId, number = 0) {
    let posts = await this.db.get(board) ?? [];
    if (!number)
      posts = posts.filter(p => p.timestamp !== threadId && p.parent !== threadId);
    else
      posts = posts.filter(p => !(p.parent === threadId && p.number === number));  

    await this.db.set(board, posts);
  }

  async deletePostsByIp(board, ip) {
    let posts = await this.db.get(board) ?? [];
    posts = posts.filter(p => p.ip !== ip);  
    await this.db.set(board, posts);
  }

  async getLastGlobalPosts(boards) {
    let posts = [];
    for(let i = 0; i < boards.length; i++) {
      const boardPosts = await this.db.get(boards[i]) ?? [];
      const postsWithBoard = boardPosts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10)
        .map(post => ({ ...post, board: boards[i] }));
      posts = [...posts, ...postsWithBoard];
    }
    return [...posts]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }

  async getPosts(board, parent = 0) {
    const posts = await this.db.get(board) ?? [];
    return posts.filter(p => p.parent === parent);
  }

  async getThreads(board) {
    return await this.getPosts(board, 0);
  }

  async getThreadsByBumpOrder(board) {
    const threads = await this.getThreads(board);
    return [...threads]
      .sort((a, b) => b.lastBump - a.lastBump);
  }

  async getLastNThreads(board, n) {
    const threads = await this.getThreads(board);
    return [...threads]
      .sort((a, b) => b.lastBump - a.lastBump)
      .slice(0, n);
  }
  
  async getLastNReplies(board, parent, n = 50) {
    const replies = await this.getPosts(board, parent);
    return [...replies]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, n)
      .reverse();
  }

  async getAllReplies(board, parent) {
    const replies = await this.getPosts(board, parent);
    return [...replies]
      .sort((a, b) => b.timestamp - a.timestamp)
      .reverse();
  }

  async getThread(board, threadId) {
    const posts = await this.getThreads(board);
    const matchingPosts = posts.filter(p => p.timestamp === parseInt(threadId));
    return posts.length > 0? (matchingPosts.length > 0? matchingPosts[0] : null) : null;
  }

  async closeThread(board, threadId) {
    let posts = await this.db.get(board) ?? [];
    posts.forEach(p => {
      if (p.timestamp === parseInt(threadId) && !p.parent)
        p.closed = true;
    });
    await this.db.set(board, posts);
  }

  async getPostByIds(board, parent, number) {
    const posts = number === 1?
      [await this.getThread(board, parent)] :
      await this.getPosts(board, parent);
    const matchingPosts = number === 1?
      [posts[0]] :
      posts.filter(p => (p.number + 1) === number);
    return posts.length > 0? (matchingPosts.length > 0? matchingPosts[0] : null) : null;
  }
}
