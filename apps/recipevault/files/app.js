'use strict';

/**
 * RecipeVault - Private Rezeptsammlung mit Portionsrechner
 * Speichert Daten unter recipes/recipes.json via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const RECIPES_DIR = 'recipes';
const RECIPES_FILE = 'recipes.json';
let boxRootName = null;

let recipes = [];
let activeCategory = 'all';
let selectedRecipeId = null;
let currentServings = 4;
let editingRecipeId = null;

// UI Elements
const recipeSearch = document.getElementById('recipe-search');
const openAddBtn = document.getElementById('open-add-btn');
const refreshBtn = document.getElementById('refresh-btn');
const recipesGrid = document.getElementById('recipes-grid');
const emptyState = document.getElementById('empty-state');
const storageStatus = document.getElementById('storage-status');

const recipesListCol = document.getElementById('recipes-list-col');
const recipeDetailCol = document.getElementById('recipe-detail-col');
const backToListBtn = document.getElementById('back-to-list-btn');
const copyIngredientsBtn = document.getElementById('copy-ingredients-btn');
const editRecipeBtn = document.getElementById('edit-recipe-btn');

// Detail Elements
const detailTitle = document.getElementById('detail-title');
const detailCat = document.getElementById('detail-cat');
const detailTime = document.getElementById('detail-time');
const scaleCurrent = document.getElementById('scale-current');
const scaleDec = document.getElementById('scale-dec');
const scaleInc = document.getElementById('scale-inc');
const detailIngredients = document.getElementById('detail-ingredients');
const detailInstructions = document.getElementById('detail-instructions');

// Counts
const countAll = document.getElementById('count-all');
const countMain = document.getElementById('count-main');
const countQuick = document.getElementById('count-quick');
const countVeg = document.getElementById('count-veg');
const countSweet = document.getElementById('count-sweet');

// Modal Elements
const recipeModal = document.getElementById('recipe-modal');
const modalHeading = document.getElementById('modal-heading');
const recipeForm = document.getElementById('recipe-form');
const fTitle = document.getElementById('f-title');
const fCat = document.getElementById('f-cat');
const fServings = document.getElementById('f-servings');
const fTime = document.getElementById('f-time');
const fIngredients = document.getElementById('f-ingredients');
const fInstructions = document.getElementById('f-instructions');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const closeModalX = document.getElementById('close-modal-x');

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function showBanner(text) {
  const b = document.getElementById('banner');
  b.textContent = text;
  b.classList.remove('hidden');
}

// 1. Storage & ShareOS.fs Setup
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    loadFallbackRecipes();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', RECIPES_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${RECIPES_DIR}/${RECIPES_FILE}`;
      await loadBoxRecipes();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackRecipes();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackRecipes();
  }
}

async function loadBoxRecipes() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, RECIPES_DIR, RECIPES_FILE);
    const text = await (await handle.blob()).text();
    recipes = JSON.parse(text);
  } catch (_) {
    createDefaultRecipes();
    await saveBoxRecipes();
  }
  renderAll();
}

async function saveBoxRecipes() {
  localStorage.setItem(`recipevault_${user}`, JSON.stringify(recipes));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, RECIPES_DIR, RECIPES_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(recipes, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${RECIPES_DIR}/${RECIPES_FILE}`, name: RECIPES_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackRecipes() {
  const raw = localStorage.getItem(`recipevault_${user}`);
  if (raw) {
    try { recipes = JSON.parse(raw); } catch (_) {}
  }
  if (!recipes || !recipes.length) {
    createDefaultRecipes();
  }
  renderAll();
}

function createDefaultRecipes() {
  recipes = [
    {
      id: 1,
      title: 'Cremige One-Pot Pasta mit Parmesan',
      category: 'Hauptgerichte',
      baseServings: 4,
      time: 25,
      ingredients: [
        { amount: 500, unit: 'g', name: 'Pasta (Penne oder Fusilli)' },
        { amount: 1, unit: 'Stk', name: 'Zwiebel (gewürfelt)' },
        { amount: 2, unit: 'Zehen', name: 'Knoblauch' },
        { amount: 200, unit: 'ml', name: 'Sahne oder Hafersahne' },
        { amount: 700, unit: 'ml', name: 'Gemüsebrühe' },
        { amount: 60, unit: 'g', name: 'Parmesan gerieben' },
        { amount: 1, unit: 'Prise', name: 'Muskatnuss & Pfeffer' }
      ],
      instructions: '1. Zwiebel und Knoblauch kurz in etwas Olivenöl anbraten.\n2. Ungekochte Pasta, Gemüsebrühe und Sahne hinzugeben.\n3. Etwa 10-12 Minuten unter gelegentlichem Rühren köcheln lassen, bis die Pasta gar ist und die Sauce cremig bindet.\n4. Vom Herd nehmen, Parmesan unterheben und mit Pfeffer und Muskat abschmecken.'
    },
    {
      id: 2,
      title: 'Klassische Guacamole & Tortilla Chips',
      category: 'Schnell & Einfach',
      baseServings: 2,
      time: 10,
      ingredients: [
        { amount: 2, unit: 'Stk', name: 'reife Avocados' },
        { amount: 1, unit: 'Stk', name: 'Limette (Saft)' },
        { amount: 1, unit: 'Stk', name: 'Tomate (entkernt)' },
        { amount: 0.5, unit: 'Stk', name: 'rote Zwiebel' },
        { amount: 1, unit: 'Prise', name: 'Meersalz & Chiliflocken' }
      ],
      instructions: '1. Avocados halbieren, Kern entfernen und das Fruchtfleisch mit einer Gabel zerdrücken.\n2. Tomate und rote Zwiebel sehr fein würfeln und unterheben.\n3. Mit frischem Limettensaft, Salz und etwas Chili abschmecken.'
    },
    {
      id: 3,
      title: 'Ofen-Gemüse mit Feta & Rosmarin',
      category: 'Vegetarisch',
      baseServings: 3,
      time: 35,
      ingredients: [
        { amount: 400, unit: 'g', name: 'Drillinge / kleine Kartoffeln' },
        { amount: 1, unit: 'Stk', name: 'Zucchini' },
        { amount: 1, unit: 'Stk', name: 'rote Paprika' },
        { amount: 200, unit: 'g', name: 'Feta' },
        { amount: 3, unit: 'EL', name: 'Olivenöl' },
        { amount: 2, unit: 'Zweige', name: 'frischer Rosmarin' }
      ],
      instructions: '1. Backofen auf 200°C Ober-/Unterhitze vorheizen.\n2. Kartoffeln halbieren, Gemüse in mundgerechte Stücke schneiden.\n3. Mit Olivenöl, Rosmarin, Salz und Pfeffer auf einem Blech vermengen.\n4. Feta grob darüber bröckeln und für 25-30 Minuten goldbraun backen.'
    }
  ];
  selectedRecipeId = 1;
}

// 2. Rendering
function renderAll() {
  renderCounts();
  renderList();
  renderDetail();
}

function renderCounts() {
  countAll.textContent = recipes.length;
  countMain.textContent = recipes.filter(r => r.category === 'Hauptgerichte').length;
  countQuick.textContent = recipes.filter(r => r.category === 'Schnell & Einfach').length;
  countVeg.textContent = recipes.filter(r => r.category === 'Vegetarisch').length;
  countSweet.textContent = recipes.filter(r => r.category === 'Dessert & Backen').length;
}

function renderList() {
  const query = recipeSearch.value.trim().toLowerCase();
  recipesGrid.innerHTML = '';

  const filtered = recipes.filter(r => {
    if (activeCategory !== 'all' && r.category !== activeCategory) return false;
    if (query) {
      const matchTitle = (r.title || '').toLowerCase().includes(query);
      const matchCat = (r.category || '').toLowerCase().includes(query);
      const matchIng = (r.ingredients || []).some(i => i.name.toLowerCase().includes(query));
      if (!matchTitle && !matchCat && !matchIng) return false;
    }
    return true;
  });

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    recipeDetailCol.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  if (!selectedRecipeId || !recipes.find(r => r.id === selectedRecipeId)) {
    selectedRecipeId = filtered[0].id;
  }

  filtered.forEach(recipe => {
    const card = document.createElement('div');
    card.className = `recipe-card ${recipe.id === selectedRecipeId ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="card-top">
        <span class="card-name">${escapeHTML(recipe.title)}</span>
        <span class="card-cat">${escapeHTML(recipe.category)}</span>
      </div>
      <div class="card-meta">
        <span>⏱️ ${recipe.time || 30} Min</span>
        <span>🍽️ ${recipe.baseServings} Portionen</span>
      </div>
    `;

    card.addEventListener('click', () => {
      selectedRecipeId = recipe.id;
      const rec = recipes.find(r => r.id === selectedRecipeId);
      currentServings = rec ? rec.baseServings : 4;
      renderAll();

      // Mobile Pane Switch
      if (window.innerWidth <= 768) {
        recipesListCol.classList.add('mobile-hide');
        recipeDetailCol.classList.remove('hidden');
        recipeDetailCol.classList.add('mobile-show');
      }
    });

    recipesGrid.appendChild(card);
  });
}

function renderDetail() {
  const recipe = recipes.find(r => r.id === selectedRecipeId);
  if (!recipe) {
    recipeDetailCol.classList.add('hidden');
    return;
  }

  recipeDetailCol.classList.remove('hidden');
  detailTitle.textContent = recipe.title;
  detailCat.textContent = recipe.category;
  detailTime.textContent = `⏱️ ${recipe.time || 30} Min`;
  scaleCurrent.textContent = currentServings;

  // Portions-Faktor berechnen
  const factor = currentServings / (recipe.baseServings || 4);

  // Zutatenliste rendern
  detailIngredients.innerHTML = '';
  recipe.ingredients.forEach(ing => {
    const li = document.createElement('li');
    let displayAmount = '';
    if (ing.amount) {
      const scaled = +(ing.amount * factor).toFixed(1);
      displayAmount = `${scaled % 1 === 0 ? scaled : scaled.toFixed(1)} ${ing.unit || ''}`;
    }
    li.innerHTML = `
      <span class="ing-amount">${escapeHTML(displayAmount)}</span>
      <span class="ing-name">${escapeHTML(ing.name)}</span>
    `;
    detailIngredients.appendChild(li);
  });

  // Zubereitungsschritte
  detailInstructions.textContent = recipe.instructions || 'Keine Zubereitungsschritte hinterlegt.';
}

// 3. Scaler Buttons (+ / -)
scaleDec.addEventListener('click', () => {
  if (currentServings > 1) {
    currentServings--;
    renderDetail();
  }
});
scaleInc.addEventListener('click', () => {
  if (currentServings < 30) {
    currentServings++;
    renderDetail();
  }
});

// 4. Zutaten in Zwischenablage kopieren (Einkaufszettel)
copyIngredientsBtn.addEventListener('click', () => {
  const recipe = recipes.find(r => r.id === selectedRecipeId);
  if (!recipe) return;

  const factor = currentServings / (recipe.baseServings || 4);
  let text = `🛒 Einkaufsliste: ${recipe.title} (${currentServings} Portionen)\n\n`;

  recipe.ingredients.forEach(i => {
    let amt = '';
    if (i.amount) {
      const scaled = +(i.amount * factor).toFixed(1);
      amt = `${scaled % 1 === 0 ? scaled : scaled.toFixed(1)} ${i.unit || ''} `;
    }
    text += `- [ ] ${amt}${i.name}\n`;
  });

  navigator.clipboard.writeText(text);
  showToast('Zutatenliste in Zwischenablage kopiert!');
});

// Mobile Zurück-Button
backToListBtn.addEventListener('click', () => {
  recipesListCol.classList.remove('mobile-hide');
  recipeDetailCol.classList.add('hidden');
  recipeDetailCol.classList.remove('mobile-show');
});

// 5. Modal Logik
function openModal(recipe = null) {
  editingRecipeId = recipe ? recipe.id : null;
  modalHeading.textContent = recipe ? 'Rezept bearbeiten' : 'Neues Rezept anlegen';

  fTitle.value = recipe ? recipe.title : '';
  fCat.value = recipe ? recipe.category : 'Hauptgerichte';
  fServings.value = recipe ? recipe.baseServings : 4;
  fTime.value = recipe ? recipe.time : 25;

  if (recipe && recipe.ingredients) {
    fIngredients.value = recipe.ingredients.map(i => `${i.amount ? i.amount + ' ' : ''}${i.unit ? i.unit + ' ' : ''}${i.name}`).join('\n');
  } else {
    fIngredients.value = '';
  }

  fInstructions.value = recipe ? recipe.instructions : '';

  modalDeleteBtn.classList.toggle('hidden', !recipe);
  recipeModal.classList.remove('hidden');
  fTitle.focus();
}

function closeModal() {
  recipeModal.classList.add('hidden');
  editingRecipeId = null;
  recipeForm.reset();
}

openAddBtn.addEventListener('click', () => openModal());
editRecipeBtn.addEventListener('click', () => {
  const r = recipes.find(x => x.id === selectedRecipeId);
  if (r) openModal(r);
});
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
recipeModal.addEventListener('click', (e) => {
  if (e.target === recipeModal) closeModal();
});

// Text-Zutaten parsen (z. B. "500 g Mehl" oder "1 Stk Zwiebel")
function parseIngredients(rawText) {
  return rawText.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^([0-9.,]+)\s*([a-zA-ZäöüÄÖÜß]+)?\s+(.+)$/);
      if (match) {
        return {
          amount: parseFloat(match[1].replace(',', '.')),
          unit: match[2] || '',
          name: match[3]
        };
      }
      return { amount: null, unit: '', name: line };
    });
}

recipeForm.addEventListener('submit', async () => {
  const title = fTitle.value.trim();
  const category = fCat.value;
  const baseServings = parseInt(fServings.value, 10) || 4;
  const time = parseInt(fTime.value, 10) || 30;
  const ingredients = parseIngredients(fIngredients.value);
  const instructions = fInstructions.value.trim();

  if (!title || !ingredients.length) return;

  if (editingRecipeId) {
    const item = recipes.find(r => r.id === editingRecipeId);
    if (item) {
      item.title = title;
      item.category = category;
      item.baseServings = baseServings;
      item.time = time;
      item.ingredients = ingredients;
      item.instructions = instructions;
    }
    showToast('Rezept aktualisiert.');
  } else {
    const newId = Date.now();
    recipes.unshift({
      id: newId,
      title,
      category,
      baseServings,
      time,
      ingredients,
      instructions
    });
    selectedRecipeId = newId;
    currentServings = baseServings;
    showToast('Rezept hinzugefügt!');
  }

  closeModal();
  renderAll();
  await saveBoxRecipes();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingRecipeId) return;
  if (!confirm('Dieses Rezept wirklich löschen?')) return;

  recipes = recipes.filter(r => r.id !== editingRecipeId);
  selectedRecipeId = recipes.length ? recipes[0].id : null;
  closeModal();
  renderAll();
  await saveBoxRecipes();
  showToast('Rezept gelöscht.');
});

// Sub-Header Filter
document.querySelectorAll('#category-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#category-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    renderList();
  });
});

recipeSearch.addEventListener('input', renderList);
refreshBtn.addEventListener('click', () => {
  initStorage();
  showToast('Aktualisiert.');
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
