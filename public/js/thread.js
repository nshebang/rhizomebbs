const $ = e => document.getElementById(e);

const autoRefresh = $('autorefresh');
const autostatus = $('autostatus');
let refreshInterval;

autoRefresh.addEventListener('change', function() {
  if (this.checked) {
    startAutorefresh();
    autostatus.textContent = '...';
  } else {
    stopAutorefresh();
    autostatus.textContent = 'no';
  }
});

function startAutorefresh() {
  let countDown = 5;

  refreshInterval = setInterval(() => {
    autostatus.textContent = `${countDown}s`;
    if (countDown-- <= 0) {
      autostatus.textContent = '...';
      fetchNewPosts();
      countDown = 5;
    }
  }, 1000);
}

function stopAutorefresh() {
  clearInterval(refreshInterval);
}

async function fetchNewPosts() {
  const currentPath = window.location.pathname;
  const match = currentPath.match(/^\/(\w+)\/threads\/(\d+)$/);
  if (!match)
    return;
  const boardName = match[1];
  const threadId = match[2];

  const response = await fetch(`/api/threads?board=${boardName}&thread=${threadId}`);
  const data = await response.json();

  if (!data)
    return;
  updateThreadReplies(data);
}

function updateThreadReplies(data) {
  const replies = data.replies;
  replies.forEach(r => {
    const number = r.number + 1;
    const existingElement = document.querySelector(`a[name="p${number}"]`);

    if (!existingElement) {
      const nameEls = document.querySelector(`span[class="name"]`);
      const fakeName = nameEls.innerHTML;

      const postEls = document.querySelector(`blockquote[class="post"]`);
      const postType = postEls? 'post' : 'aapost';

      const anchorEl = document.createElement('a');
      anchorEl.setAttribute('name', `p${number}`);

      const h4El = document.createElement('h4');
      h4El.innerHTML = `
        ${number}. 
        <span class="name">${fakeName}</span>
        <span class="date">${new Date(r.timestamp).toISOString()}</span>
        ${r.userId ? `<span class="uid">ID:${r.userId}</span>` : ''}
      `;

      const blockquoteEl = document.createElement('blockquote');
      blockquoteEl.className = postType;
      blockquoteEl.innerHTML = r.content;

      const lastBlockquote = document.querySelector('blockquote:last-of-type');
      if (lastBlockquote) {
        lastBlockquote.insertAdjacentElement('afterend', anchorEl);
        anchorEl.insertAdjacentElement('afterend', h4El);
        h4El.insertAdjacentElement('afterend', blockquoteEl);
      }
    }
  });
}
