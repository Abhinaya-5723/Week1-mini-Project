// script.js - Pokédex example app using PokeAPI
const API_BASE = 'https://pokeapi.co/api/v2/pokemon';
const DEFAULT_COUNT = 12;

const elements = {
  cards: document.getElementById('cards'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  themeToggle: document.getElementById('themeToggle'),
  resetBtn: document.getElementById('resetBtn')
};

function showLoading(show = true){
  elements.loading.classList.toggle('hidden', !show);
}
function showError(msg = '') {
  if(!msg) elements.error.classList.add('hidden');
  else {
    elements.error.textContent = msg;
    elements.error.classList.remove('hidden');
  }
}

// persist theme & last search
const storage = {
  get(key){ try { return JSON.parse(localStorage.getItem(key)); } catch(e){ return null } },
  set(key,val){ localStorage.setItem(key, JSON.stringify(val)); }
};

// theme
function applyThemeFromStorage(){
  const theme = storage.get('theme') || 'light';
  document.body.classList.toggle('dark', theme==='dark');
}
function toggleTheme(){
  const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
  document.body.classList.toggle('dark', newTheme === 'dark');
  storage.set('theme', newTheme);
}
elements.themeToggle.addEventListener('click', toggleTheme);

// create card UI for a pokemon object
function createCard(poke){
  const card = document.createElement('article');
  card.className = 'card';
  card.setAttribute('data-name', poke.name);

  const img = document.createElement('img');
  img.className = 'poke-img';
  img.alt = poke.name;
  img.src = poke.sprites?.other?.['official-artwork']?.front_default
            || poke.sprites?.front_default
            || 'https://via.placeholder.com/120?text=?';

  const name = document.createElement('h3');
  name.className = 'poke-name';
  name.textContent = poke.name;

  const id = document.createElement('div');
  id.className = 'poke-id';
  id.textContent = `#${poke.id} • ${poke.height/10}m • ${poke.weight/10}kg`;

  const typesWrap = document.createElement('div');
  typesWrap.className = 'types';
  poke.types.forEach(t => {
    const span = document.createElement('span');
    span.className = 'type';
    span.textContent = t.type.name;
    typesWrap.appendChild(span);
  });

  const statsWrap = document.createElement('div');
  statsWrap.className = 'stats';
  ['hp','attack','defense','speed'].forEach(keyName=>{
    const statObj = poke.stats.find(s => {
      const n = s.stat.name;
      return n.includes(keyName) || (keyName==='hp' && n==='hp');
    });
    if(statObj){
      const el = document.createElement('div');
      el.className='stat';
      el.textContent = `${statObj.stat.name}: ${statObj.base_stat}`;
      statsWrap.appendChild(el);
    }
  });

  card.append(img, name, id, typesWrap, statsWrap);
  return card;
}

// fetch single pokemon by name or id
async function fetchPokemon(identifier){
  const url = `${API_BASE}/${encodeURIComponent(identifier.toString().toLowerCase())}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Pokémon not found: ${identifier}`);
  return await res.json();
}

// fetch initial list (first N) then details
async function fetchInitialList(limit = DEFAULT_COUNT){
  showError('');
  showLoading(true);
  try {
    const listResp = await fetch(`${API_BASE}?limit=${limit}`);
    if(!listResp.ok) throw new Error('Failed to load list');
    const listData = await listResp.json();
    const items = listData.results || [];
    // fetch details in parallel
    const details = await Promise.all(items.map(it => fetch(it.url).then(r=>r.json())));
    return details;
  } finally {
    showLoading(false);
  }
}

// render array of pokemon objects
function renderCards(pokemons = []){
  elements.cards.innerHTML = '';
  if(!pokemons.length){
    elements.cards.innerHTML = `<p style="grid-column:1/-1;color:var(--muted)">No results found.</p>`;
    return;
  }
  const frag = document.createDocumentFragment();
  pokemons.forEach(p => frag.appendChild(createCard(p)));
  elements.cards.appendChild(frag);
}

// initial load: either perform last search or load the first N pokemon
async function init(){
  applyThemeFromStorage();

  // restore last search if exists
  const lastSearch = storage.get('lastSearch') || '';
  if(lastSearch){
    elements.searchInput.value = lastSearch;
    await doSearch(lastSearch, {store: false}); // show stored search result
  } else {
    // fetch default list
    try {
      showError('');
      showLoading(true);
      const pokemons = await fetchInitialList(DEFAULT_COUNT);
      renderCards(pokemons);
    } catch(err){
      showError('Unable to load Pokémon list. Try again later.');
    } finally {
      showLoading(false);
    }
  }
}

// search handler: either fetch single pokemon or filter by substring
async function doSearch(query, {store=true} = {}){
  query = (query || '').trim();
  showError('');
  elements.cards.innerHTML = '';
  if(!query){
    // if empty, reload default list
    init();
    return;
  }

  showLoading(true);
  try {
    // Try fetching exact pokemon by name or id
    try {
      const p = await fetchPokemon(query);
      renderCards([p]);
      if(store) storage.set('lastSearch', query);
      return;
    } catch(err){
      // not exact match; try a partial search among first N pokemons
      const limit = 200; // search broader (200 first pokemons)
      const listResp = await fetch(`${API_BASE}?limit=${limit}`);
      if(!listResp.ok) throw new Error('Search failed.');
      const listData = await listResp.json();
      const matches = listData.results.filter(r => r.name.includes(query.toLowerCase()));
      if(matches.length === 0){
        throw new Error('No matching Pokémon found.');
      }
      // fetch up to first 24 matches' details
      const details = await Promise.all(matches.slice(0,24).map(m => fetch(m.url).then(r=>r.json())));
      renderCards(details);
      if(store) storage.set('lastSearch', query);
    }
  } catch(err){
    showError(err.message || 'Search failed.');
  } finally {
    showLoading(false);
  }
}

// event listeners
elements.searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = elements.searchInput.value;
  await doSearch(q, {store:true});
});

elements.resetBtn.addEventListener('click', () => {
  elements.searchInput.value = '';
  storage.set('lastSearch', '');
  init();
});

// keyboard Enter in input is handled by form submit already

// run init
init();
