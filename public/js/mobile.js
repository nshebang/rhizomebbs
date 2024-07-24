function switchNav() {
  if (!window.location.pathname.includes('/threads/'))
    useMainMobileNav();
  else
    useThreadMobileNav();
}

function useMainMobileNav() {
  const nav = document.getElementsByTagName('nav')[0];
  const navLinks = nav.getElementsByTagName('a');
  const navSelect = document.createElement('select');
  const board = window.location.pathname.split('/')[1];

  for (let i = 0; i < navLinks.length; i++) {
    console.log(navLinks[i]);
    if (navLinks[i].href.includes('https://ichoria.org') ||
        navLinks[i].attributes.href.nodeValue === '/' ||
        navLinks[i].attributes.href.nodeValue.includes('info') ||
        navLinks[i].attributes.href.nodeValue.includes('search'))
      continue;
    const option = document.createElement('option');
    option.text = navLinks[i].textContent;
    option.value = navLinks[i].attributes.href.nodeValue;
    navSelect.appendChild(option);
  }
  
  navSelect.style.width = '120px';
  navSelect.value = `/${board}`;
  navSelect.addEventListener('change', event => {
    window.location = event.target.value;
  });

  nav.style.textAlign = 'center';
  nav.innerHTML = `<a href="/">Portada</a> | <a href="/info">Ayuda</a> | `;
  nav.appendChild(navSelect);
}

function useThreadMobileNav() {
  const nav = document.getElementsByTagName('nav')[0];
  const board = window.location.pathname.split('/')[1];

  nav.style.textAlign = 'center';
  nav.style.fontSize = '10pt';
  nav.innerHTML = `<a href="/${board}">Volver</a> | 
  <a href="#postform"><b>Responder</b></a> |
  <a href="/info">Ayuda</a> |
  <a href="/search">Buscar</a> |
  <a href="/${board}/list">Lista</a>`;
}

window.addEventListener('DOMContentLoaded', () => {
  if (document.body.clientWidth < 767)
    switchNav();
});
