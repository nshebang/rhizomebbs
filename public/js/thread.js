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
    const existingElement = $(`p${number}`);

    if (!existingElement) {
      const nameEls = document.querySelector(`span[class="name"]`);
      const fakeName = nameEls.innerHTML;

      const postEls = document.querySelector(`blockquote[class="post"]`);
      const postType = postEls? 'post' : 'aapost';

      const anchorEl = document.createElement('div');
      anchorEl.id = `p${number}`;
      anchorEl.className = 'anchor';

      const h4El = document.createElement('h4');
      h4El.innerHTML = `
        ${number}. 
        <span class="name">${fakeName}</span>
        <span class="date">${new Date(r.timestamp).toLocaleString('es', { timeZone: 'UTC' })} UTC</span>
        ${r.userId ? `<span class="uid">ID:${r.userId}</span>` : ''}
        <span class="post-controls">
          <a href="/delete?board=${r.board}&thread=${r.parent}&number=${number}"
            rel="nofollow"
            onclick="if (!confirm('¿Eliminar post no. ${number}?')) return false;">del</a>
        </span>
      `;
      h4El.classList.add('metadata');

      const blockquoteEl = document.createElement('blockquote');
      blockquoteEl.className = postType;
      blockquoteEl.innerHTML = r.content;

      anchorEl.appendChild(h4El);
      anchorEl.appendChild(blockquoteEl);

      const lastPostDiv = document.querySelector('div[class="anchor"]:last-of-type');
      if (lastPostDiv) {
        lastPostDiv.insertAdjacentElement('afterend', anchorEl);
      }
    }
  });
}
