let mouseX = 0, mouseY = 0;

function trackMouse(e) {
  mouseX = e.clientX;
  mouseY = e.clientY;
}

document.addEventListener('mousemove', trackMouse);

async function whoAmIQuoting(quoteEl) {
  const target = getPostIds(quoteEl.href);
  if (!target.board || !target.threadId || !target.postId)
    return;

  let data;
  let attempts = 0;

  while(!data && attempts < 4) {
    data = await fetchPost(target.board, target.threadId, target.postId);
    attempts++;
  }

  if (!data)
    return;
  const post = data.post;

  createFloatingReply(post, quoteEl);
}

function getPostIds(url) {
  const regex = /\/([^/]+)\/threads\/(\d+)#p(\d+)/;
  const match = url.match(regex);

  if (match) {
    const board = match[1];
    const threadId = parseInt(match[2]);
    const postId = parseInt(match[3]);

    return { board, threadId, postId };
  }
  return null;
}

async function fetchPost(board, threadId, postId) {
  const response = await fetch(`/api/post?board=${board}&thread=${threadId}&number=${postId}`);
  return await response.json();
}

function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function isMouseTooFar(quoteEl, mx, my, threshold) {
  const rect = quoteEl.getBoundingClientRect();
  const linkX = rect.left + rect.width / 2;
  const linkY = rect.top + rect.height / 2;
  const distance = calculateDistance(mx, my, linkX, linkY);
  return distance > threshold;
}

function createFloatingReply(post, quoteEl) {
  const nameEls = document.querySelector(`span[class="name"]`);
  const fakeName = nameEls.innerHTML;

  const postEls = document.querySelector(`blockquote[class="post"]`);
  const postType = postEls? 'post' : 'aapost';
  
  const floatingReply = document.createElement('div');
  floatingReply.id = 'floatingReply';
  floatingReply.style.display = 'none';

  floatingReply.innerHTML = `
  <h4>${post.number + 1}. 
  <span class="name">${fakeName}</span>
  ${post.capcode? '<span class="capcode"> ## Admin </span>' : ''}
  <span class="date">${new Date(post.timestamp).toISOString()}</span>
  ${post.userId ? `<span class="uid">ID:${post.userId}</span>` : ''}
  </h4>
  ${postType === 'post' ? `<blockquote class="post">` : '<blockquote class="aapost">'}
    ${post.content}
  </blockquote>`;
  floatingReply.style.left = (mouseX + 5) + 'px';
  floatingReply.style.top = (mouseY + window.scrollY + 5) + 'px';

  document.addEventListener('mousemove', e => {
    floatingReply.style.left = (e.clientX + 5) + 'px';
    floatingReply.style.top = (e.clientY + window.scrollY + 5) + 'px';

    if (isMouseTooFar(quoteEl, e.clientX, e.clientY, 100))
      if (floatingReply)
        floatingReply.remove();
  });

  quoteEl.addEventListener('mouseleave', () => {
    if (floatingReply)
      floatingReply.remove();
  });

  document.body.appendChild(floatingReply);

  floatingReply.style.display = 'block';
}
