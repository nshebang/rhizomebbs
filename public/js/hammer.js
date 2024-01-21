function ban(ip) {
  const reason = prompt('Motivo del baneo:');
  if (reason === null || reason.trim() === '')
    return;
  const length = prompt('Duración del baneo (1d, 2h, 30m, 0 = permanente):');
  if (length === null || length.trim() === '')
    return;

  const redirectURL = `/admin/ban?ip=${ip}&reason=${encodeURIComponent(reason)}&length=${encodeURIComponent(length)}`;

  window.location.href = redirectURL;
}

function nuke(ip) {
  const reason = prompt('Motivo del baneo:');
  if (reason === null || reason.trim() === '')
    return;
  const length = prompt('Duración del baneo (1d, 2h, 30m, 0 = permanente):');
  if (length === null || length.trim() === '')
    return;
  if (!confirm('Esta función borrará todos los posts del usuario en el BBS ¿proceder?'))
    return;

  const redirectURL = `/admin/nuke?ip=${ip}&reason=${encodeURIComponent(reason)}&length=${encodeURIComponent(length)}`;

  window.location.href = redirectURL;
}

function extractResultString(html) {
  const match = /<h2>(.*?)<\/h2>/i.exec(html);
  return match ? match[1] : null;
}

async function deleteAndBan(board, thread, number, ip) {
  const reason = prompt('Motivo del baneo:');
  if (reason === null || reason.trim() === '')
    return;
  const length = prompt('Duración del baneo (1d, 2h, 30m, 0 = permanente):');
  if (length === null || length.trim() === '')
    return;

  Promise.all([
    fetch(`/delete?board=${board}&thread=${thread}&number=${number}`),
    fetch(`/admin/ban?ip=${ip}&reason=${reason}&length=${length}`),
  ])
  .then(responses => {
    return Promise.all(responses.map(response => response.text())); 
  })
  .then(htmlResults => {
    const deleteResult = extractResultString(htmlResults[0]);
    const banResult = extractResultString(htmlResults[1]);
    alert(`Eliminación :\n${deleteResult}\n\nBaneo:\n${banResult}`);
    window.location.reload();
  })
  .catch(error => {
    console.error('Error al ejecutar:', error);
  });
}
