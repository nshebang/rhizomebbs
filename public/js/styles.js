const styleSelector = document.getElementById('style-selector');

function setStyle() {
  const selectedStyle = localStorage.getItem('selectedStyle') || '';
  if (!selectedStyle.length)
    return;

  for (let i = 0; i < document.styleSheets.length; i++) {
    const style = document.styleSheets[i];
    style.disabled = selectedStyle !== style.title;
  }

  if (styleSelector)
    styleSelector.value = selectedStyle;
}

function changeStyle() {
  if (styleSelector) {
    const selectedStyle = styleSelector.value;

    localStorage.setItem('selectedStyle', selectedStyle);

    for (let i = 0; i < document.styleSheets.length; i++) {
      const style = document.styleSheets[i];
      style.disabled = selectedStyle !== style.title;
    }
  }
}

window.onload = setStyle;

if (styleSelector)
  styleSelector.addEventListener('change', changeStyle);
