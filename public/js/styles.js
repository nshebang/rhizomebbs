const styleSelector = document.getElementById('style-selector');
const styleGroup = ''; 

function loadActiveStyleSheet(title) {
  const links = document.getElementsByTagName('link');
  let found = false;
  
  for (let i = 0; i < links.length; i++) {
    const rel = links[i].getAttribute('rel');
    const styleTitle = links[i].getAttribute('title');

    if (styleTitle === 'paintbbs')
      continue;
    
    if (rel.indexOf('style') !== -1 && title) {
      links[i].disabled = true;
      if (styleTitle === title) {
        links[i].disabled = false;
        found = true;
      }
    }
  }
  
  if (found)
    localStorage.setItem(styleGroup, title);
  
  return found;
}

function getPreferredStyleSheet() {
  const links = document.getElementsByTagName('link');
  for (let i = 0; i < links.length; i++) {
    const rel = links[i].getAttribute('rel');

    if (links[i].getAttribute('title') === 'paintbbs')
      continue;

    if (rel.indexOf('stylesheet') !== -1 &&
        rel.indexOf('alternate') === -1 &&
        links[i].hasAttribute('title'))
      return links[i].getAttribute('title');
  }
  return null;
}

function loadStyleSelector() {
  const title = localStorage.getItem(styleGroup); 
  const selectedStyle = title? title : getPreferredStyleSheet();
  if (selectedStyle) {
    const result = loadActiveStyleSheet(selectedStyle);
    if (!result)
      localStorage.removeItem(styleGroup); 
  }
}

function setStyle() {
  let selectedStyle = localStorage.getItem(styleGroup) || '';
  if (!selectedStyle)
    selectedStyle = getPreferredStyleSheet() || '';
  
  if (!selectedStyle)
    return;
  
  const links = document.querySelectorAll('link[title]');
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (link.title === 'paintbbs')
      continue;
    link.disabled = selectedStyle !== link.title;
  }
  
  if (styleSelector)
    styleSelector.value = selectedStyle;
}

function changeStyle() {
  if (!styleSelector)
    return;
  
  const selectedStyle = styleSelector.value;
  localStorage.setItem(styleGroup, selectedStyle);
  setStyle();
}

window.onload = function() {
  loadStyleSelector();
  setStyle(); // fuck chromium
};

if (styleSelector)
  styleSelector.addEventListener('change', changeStyle);
