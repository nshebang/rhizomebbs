/*
  PaintBBS Neo plugin / adaptation for ichoria.org and rhizomebbs
*/
const submitButton = document.getElementById('submit-drawing');

function base64ToFile(base64Data, filename, mimeType) {
  mimeType = mimeType || (base64Data.match(/^data:([^;]+);/) || '')[1];
  const byteCharacters = atob(base64Data.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++)
    byteNumbers[i] = byteCharacters.charCodeAt(i);

  const byteArray = new Uint8Array(byteNumbers);
  return new File([byteArray], filename, { type: mimeType });
}


submitButton.addEventListener('click', async () => {
  if (!confirm('¿Terminar tu dibujo y enviarlo a tu post?'))
    return;

  const imageDataURL = Neo.painter.getImage().toDataURL();
  console.log(imageDataURL);
  const file = base64ToFile(imageDataURL, `${Date.now()}.png`, 'image/png');
  
  const postData = new FormData();
  postData.append('file', file);

  const headers = new Headers();
  headers.append('X-Requested-With', 'NEO');

  const response = await fetch('https://saki.ichoria.org/', {
    method: 'POST',
    headers: headers,
    body: postData,
  });

  if (response.ok) {
    const params = new URLSearchParams(window.location.search);
    const parent = params.get('parent') ?? '';
    const board = window.location.pathname.split('/')[1];
    const link = await response.text();

    if (params.get('parent') !== '0')
      window.location = `${window.location.origin}/${board}/threads/${parent}?file=${link}&parent=${parent}#postform`;
    else
      window.location = `${window.location.origin}/${board}?file=${link}&parent=${parent}#postform`;
  } else {
    alert(`El servidor de saki.ichoria.org reportó un error al subir tu archivo. Estado HTTP=${response.status}`);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  Neo.submitButton.disable();
  const neoSubmit = document.getElementById('submit');
  neoSubmit.style.display = 'none';
});
