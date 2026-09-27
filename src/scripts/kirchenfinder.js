const finder = document.querySelector('[data-church-finder]');
if (finder) {
  const form = finder.querySelector('[data-church-filter]');
  const entries = [...finder.querySelectorAll('[data-church-entry]')];
  const count = finder.querySelector('[data-church-count]');
  const empty = finder.querySelector('[data-church-empty]');
  const normalize = value => value.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g,'ss').trim();
  const loadState = () => {
    const params = new URLSearchParams(location.search);
    for (const name of ['q','bereich','konfession']) form.elements.namedItem(name).value = (params.get(name) || '').slice(0,120);
  };
  const apply = () => {
    const data = new FormData(form);
    const terms = normalize(String(data.get('q') || '')).split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const entry of entries) {
      const match = terms.every(term => normalize(entry.dataset.search).includes(term)) && (!data.get('bereich') || entry.dataset.region === data.get('bereich')) && (!data.get('konfession') || entry.dataset.denomination === data.get('konfession'));
      entry.hidden = !match;
      if (match) matches++;
    }
    count.textContent = `${matches} ${matches === 1 ? 'Trauort' : 'Trauorte'} von ${entries.length} in dieser Auswahl`;
    empty.hidden = matches > 0;
  };
  const saveState = () => {
    const url = new URL(location.href);
    for (const name of ['q','bereich','konfession']) {
      const value = form.elements.namedItem(name).value.trim();
      if (value) url.searchParams.set(name,value); else url.searchParams.delete(name);
    }
    url.hash = 'kirchen';
    if (url.href !== location.href) history.pushState(null,'',url);
  };
  form.addEventListener('submit',event => {event.preventDefault();apply();saveState();count.focus({preventScroll:true});});
  finder.querySelectorAll('[data-church-reset]').forEach(button => button.addEventListener('click',() => {form.reset();apply();saveState();form.elements.namedItem('q').focus({preventScroll:true});}));
  window.addEventListener('popstate',() => {loadState();apply();});
  loadState();
  apply();
  form.hidden = false;
  const openAnchor = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const entry = entries.find(entry => entry.id === id);
    if (entry) {
      if (entry.hidden) {
        form.reset();
        apply();
        const url=new URL(location.href);
        for(const name of ['q','bereich','konfession']) url.searchParams.delete(name);
        history.replaceState(null,'',url);
      }
      entry.querySelector('details').open=true;
    }
  };
  openAnchor();
  window.addEventListener('hashchange',openAnchor);
}
