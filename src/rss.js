import RSS from 'rss';

export class RSSMngr {
  generateFeed(siteUrl, posts) {
    const feed = new RSS({
      title: 'Ichoria BBS',
      description: 'BBS anónimo en español',
      feed_url: `${siteUrl}/rss`,
      site_url: siteUrl,
      language: 'es',
      pubDate: new Date()
    });

    posts.forEach(post => {
      const threadId = post.parent > 0 ?
        post.parent :
        post.timestamp;

      feed.item({
        title: `${post.board}/${threadId}#p${post.number + 1}`,
        description: post.content,
        url: `${siteUrl}/${post.board}/threads/${threadId}#p${post.number + 1}`,
        guid: `${siteUrl}/${post.board}/threads/${threadId}#p${post.number + 1}`,
        date: new Date(post.timestamp)
      });
    });

    return feed.xml({ indent: true });
  }
}
