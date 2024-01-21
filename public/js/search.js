const searchBar = document.getElementById('searchbar');
const threadRows = document.getElementsByTagName('tr');
let titles = [];

function* enumerate(iterable) {
  let i = 0;
  for (const x of iterable) {
    yield [i, x];
    i++;
  }
}

function filterThreads(searchInput) {
  for (const [i, row] of enumerate(threadRows)) {
    if (!i)
      continue;
    const title = row.cells[1].innerText.toLowerCase();
    const display = title.includes(searchInput.toLowerCase()) ? '' : 'none';
    row.style.display = display;
  }
}

window.addEventListener('DOMContentLoaded', function() {
  for (const [i, row] of enumerate(threadRows)) {
    if (!i)
      continue;
    const title = row.cells[1].innerText;
    titles.push(title);
  }
});

searchBar.addEventListener('input', () => {
  const searchInput = searchBar.value.trim();

  if (searchInput === '') {
    for (const [i, row] of enumerate(threadRows)) {
      if (!i)
        continue;
      row.style.display = '';
    }
  } else {
    filterThreads(searchInput);
  }
});
