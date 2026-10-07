// Forja: la dieta que arma el entrenador (función Pro). Comidas del día con sus alimentos y
// porciones, objetivos diarios y totales calculados por alimento.
//
// Los valores por 100 g son aproximados (tablas de composición de referencia, alimentos ya
// cocidos salvo que diga lo contrario). Para algo que no esté en la lista, el entrenador carga
// un alimento propio con sus macros por porción.

// kcal, proteína (p), carbohidratos (c) y grasa (f) por 100 g. `unit`: porción casera en gramos.
export const FOODS = [
  // Proteínas
  { id: 'huevo', icon: '🥚', cat: 'proteina', name: 'Huevo entero', kcal: 143, p: 12.6, c: 0.7, f: 9.5, unit: { label: 'huevo', g: 50 } },
  { id: 'clara', icon: '🥚', cat: 'proteina', name: 'Clara de huevo', kcal: 52, p: 10.9, c: 0.7, f: 0.2, unit: { label: 'clara', g: 33 } },
  { id: 'pollo', icon: '🍗', cat: 'proteina', name: 'Pechuga de pollo a la plancha', kcal: 165, p: 31, c: 0, f: 3.6 },
  { id: 'res-magra', icon: '🥩', cat: 'proteina', name: 'Bistec de res magro', kcal: 190, p: 29, c: 0, f: 8 },
  { id: 'carne-molida', icon: '🥩', cat: 'proteina', name: 'Carne molida magra', kcal: 217, p: 26, c: 0, f: 12 },
  { id: 'cerdo', icon: '🥓', cat: 'proteina', name: 'Lomo de cerdo', kcal: 200, p: 29, c: 0, f: 9 },
  { id: 'pescado', icon: '🐟', cat: 'proteina', name: 'Pescado blanco', kcal: 105, p: 23, c: 0, f: 1.2 },
  { id: 'atun', icon: '🐟', cat: 'proteina', name: 'Atún en agua (escurrido)', kcal: 116, p: 26, c: 0, f: 0.8, unit: { label: 'lata', g: 120 } },
  { id: 'sardina', icon: '🐟', cat: 'proteina', name: 'Sardinas en lata (escurridas)', kcal: 208, p: 25, c: 0, f: 11, unit: { label: 'lata', g: 120 } },
  { id: 'queso-blanco', icon: '🧀', cat: 'proteina', name: 'Queso blanco', kcal: 300, p: 20, c: 2, f: 24, unit: { label: 'rebanada', g: 30 } },
  { id: 'yogur-griego', icon: '🥛', cat: 'proteina', name: 'Yogur griego natural 0 %', kcal: 59, p: 10.2, c: 3.6, f: 0.4, unit: { label: 'envase', g: 170 } },
  { id: 'leche-desc', icon: '🥛', cat: 'proteina', name: 'Leche descremada', kcal: 34, p: 3.4, c: 5, f: 0.1, unit: { label: 'taza', g: 240 } },
  { id: 'leche-entera', icon: '🥛', cat: 'proteina', name: 'Leche entera', kcal: 61, p: 3.2, c: 4.8, f: 3.3, unit: { label: 'taza', g: 240 } },
  { id: 'whey', icon: '💪', cat: 'proteina', name: 'Proteína whey (polvo)', kcal: 400, p: 80, c: 10, f: 5, unit: { label: 'scoop', g: 30 } },
  // Carbohidratos
  { id: 'arepa', icon: '🫓', cat: 'carbo', name: 'Arepa de maíz asada', kcal: 190, p: 4, c: 40, f: 1, unit: { label: 'arepa mediana', g: 90 } },
  { id: 'harina-maiz', icon: '🌽', cat: 'carbo', name: 'Harina de maíz precocida (cruda)', kcal: 350, p: 7.5, c: 77, f: 1.3 },
  { id: 'arroz', icon: '🍚', cat: 'carbo', name: 'Arroz blanco', kcal: 130, p: 2.7, c: 28, f: 0.3, unit: { label: 'taza', g: 160 } },
  { id: 'arroz-integral', icon: '🍚', cat: 'carbo', name: 'Arroz integral', kcal: 123, p: 2.7, c: 25.6, f: 1, unit: { label: 'taza', g: 160 } },
  { id: 'pasta', icon: '🍝', cat: 'carbo', name: 'Pasta', kcal: 158, p: 5.8, c: 31, f: 0.9, unit: { label: 'taza', g: 140 } },
  { id: 'caraotas', icon: '🫘', cat: 'carbo', name: 'Caraotas negras', kcal: 132, p: 8.9, c: 23.7, f: 0.5, unit: { label: 'taza', g: 170 } },
  { id: 'lentejas', icon: '🫘', cat: 'carbo', name: 'Lentejas', kcal: 116, p: 9, c: 20, f: 0.4, unit: { label: 'taza', g: 200 } },
  { id: 'platano', icon: '🍌', cat: 'carbo', name: 'Plátano maduro sancochado u horneado', kcal: 116, p: 0.8, c: 31, f: 0.2 },
  { id: 'papa', icon: '🥔', cat: 'carbo', name: 'Papa sancochada', kcal: 87, p: 1.9, c: 20, f: 0.1 },
  { id: 'yuca', icon: '🥔', cat: 'carbo', name: 'Yuca sancochada', kcal: 125, p: 1, c: 30, f: 0.3 },
  { id: 'batata', icon: '🍠', cat: 'carbo', name: 'Batata', kcal: 90, p: 2, c: 20.7, f: 0.2 },
  { id: 'avena', icon: '🥣', cat: 'carbo', name: 'Avena en hojuelas (cruda)', kcal: 379, p: 13.2, c: 67.7, f: 6.5, unit: { label: 'taza', g: 80 } },
  { id: 'pan-integral', icon: '🍞', cat: 'carbo', name: 'Pan integral', kcal: 250, p: 12.5, c: 43, f: 3.5, unit: { label: 'rebanada', g: 30 } },
  // Frutas y vegetales
  { id: 'cambur', icon: '🍌', cat: 'fruta', name: 'Cambur', kcal: 89, p: 1.1, c: 22.8, f: 0.3, unit: { label: 'cambur', g: 120 } },
  { id: 'manzana', icon: '🍎', cat: 'fruta', name: 'Manzana', kcal: 52, p: 0.3, c: 13.8, f: 0.2, unit: { label: 'manzana', g: 180 } },
  { id: 'lechosa', icon: '🍈', cat: 'fruta', name: 'Lechosa', kcal: 43, p: 0.5, c: 10.8, f: 0.3, unit: { label: 'taza', g: 145 } },
  { id: 'pina', icon: '🍍', cat: 'fruta', name: 'Piña', kcal: 50, p: 0.5, c: 13.1, f: 0.1, unit: { label: 'taza', g: 165 } },
  { id: 'fresas', icon: '🍓', cat: 'fruta', name: 'Fresas', kcal: 32, p: 0.7, c: 7.7, f: 0.3, unit: { label: 'taza', g: 150 } },
  { id: 'jugo-naranja', icon: '🍊', cat: 'fruta', name: 'Jugo de naranja natural', kcal: 45, p: 0.7, c: 10.4, f: 0.2, unit: { label: 'vaso', g: 240 } },
  { id: 'ensalada', icon: '🥗', cat: 'vegetal', name: 'Ensalada verde (lechuga, tomate, pepino)', kcal: 18, p: 1, c: 3.5, f: 0.2, unit: { label: 'taza', g: 100 } },
  { id: 'brocoli', icon: '🥦', cat: 'vegetal', name: 'Brócoli', kcal: 35, p: 2.4, c: 7.2, f: 0.4, unit: { label: 'taza', g: 155 } },
  { id: 'vegetales', icon: '🥕', cat: 'vegetal', name: 'Vegetales mixtos', kcal: 50, p: 2.5, c: 10, f: 0.3, unit: { label: 'taza', g: 150 } },
  // Grasas
  { id: 'aguacate', icon: '🥑', cat: 'grasa', name: 'Aguacate', kcal: 160, p: 2, c: 8.5, f: 14.7 },
  { id: 'aceite-oliva', icon: '🫒', cat: 'grasa', name: 'Aceite de oliva', kcal: 884, p: 0, c: 0, f: 100, unit: { label: 'cucharada', g: 14 } },
  { id: 'mani', icon: '🥜', cat: 'grasa', name: 'Mantequilla de maní', kcal: 588, p: 25, c: 20, f: 50, unit: { label: 'cucharada', g: 16 } },
  { id: 'almendras', icon: '🌰', cat: 'grasa', name: 'Almendras', kcal: 579, p: 21, c: 21.6, f: 49.9, unit: { label: 'almendra', g: 1.2 } },
  // Bebidas
  { id: 'cafe', icon: '☕', cat: 'bebida', name: 'Café negro sin azúcar', kcal: 2, p: 0.3, c: 0, f: 0, unit: { label: 'taza', g: 240 } },
]
const BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]))

// Categorías de la grilla de alimentos, en el orden en que se muestran.
export const FOOD_CATS = [
  { key: 'proteina', label: 'Proteínas' }, { key: 'carbo', label: 'Carbohidratos' }, { key: 'fruta', label: 'Frutas' },
  { key: 'vegetal', label: 'Vegetales' }, { key: 'grasa', label: 'Grasas' }, { key: 'bebida', label: 'Bebidas' },
]
export const foodsIn = cat => FOODS.filter(f => f.cat === cat)

// Gramos que se ofrecen como botones rápidos al elegir un alimento, pensados en su porción
// casera: 5–20 almendras, 1–3 huevos o cucharadas, ½–2 tazas; sin porción, 50 a 250 g.
export function quickGrams(food) {
  const u = food.unit
  const r = v => Math.round(v * 10) / 10
  if (!u) return [50, 100, 150, 200, 250]
  const counts = u.g < 5 ? [5, 10, 15, 20] : u.g <= 60 ? [1, 2, 3] : [0.5, 1, 1.5, 2]
  const out = new Set(counts.map(n => r(n * u.g)))
  if (u.g >= 20 && u.g <= 60) { out.add(100); out.add(150) }
  return [...out].sort((a, b) => a - b)
}
export const foodById = id => BY_ID[id] || null

export const MACROS = [
  { key: 'kcal', label: 'Calorías', unit: 'kcal' },
  { key: 'protein', label: 'Proteína', unit: 'g' },
  { key: 'carbs', label: 'Carbohidratos', unit: 'g' },
  { key: 'fat', label: 'Grasas', unit: 'g' },
]
export const MEAL_NAMES = ['Desayuno', 'Merienda', 'Almuerzo', 'Merienda', 'Cena']
export const LIMITS = { meals: 8, items: 25, text: 80, notes: 1000 }

const r1 = n => Math.round(n * 10) / 10
const num = v => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

// Un alimento de la lista en `grams` gramos, con sus macros ya calculados.
export function itemFromFood(food, grams) {
  const k = grams / 100
  return { food: food.id, name: food.name, grams,
    kcal: Math.round(food.kcal * k), protein: r1(food.p * k), carbs: r1(food.c * k), fat: r1(food.f * k) }
}

// Lo que cabe en una porción casera, para mostrar "≈ 2 huevos" junto a los gramos.
export function unitsText(item) {
  const u = foodById(item.food)?.unit
  if (!u || !item.grams) return ''
  const n = Math.round(item.grams / u.g * 2) / 2
  if (n <= 0) return ''
  const whole = Math.floor(n), half = n % 1 ? '½' : ''
  const plural = n > 1 && !/s$/.test(u.label) ? (/[aeiouáéó]$/.test(u.label) ? 's' : 'es') : ''
  return `≈ ${whole || ''}${half} ${u.label}${plural}`
}

export function mealTotals(meal) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const it of meal?.items || []) for (const m of MACROS) t[m.key] += Number(it[m.key]) || 0
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) }
}

export function dayTotals(meals = []) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const meal of meals) { const m = mealTotals(meal); for (const k in t) t[k] += m[k] }
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) }
}

// Cuánto del objetivo cubren los totales: { kcal: { total, target, pct } }; sin objetivo, pct null.
export function versusTargets(totals, targets = {}) {
  const out = {}
  for (const m of MACROS) {
    const target = Number(targets?.[m.key]) || null
    out[m.key] = { total: totals[m.key], target, pct: target ? Math.round(totals[m.key] / target * 100) : null }
  }
  return out
}

// kcal que salen de los macros (4/4/9), para avisar si un alimento propio no cuadra.
export const kcalFromMacros = ({ protein = 0, carbs = 0, fat = 0 }) => Math.round(protein * 4 + carbs * 4 + fat * 9)

// Valida el formulario de un alimento propio (macros de la porción completa).
export function customItem(form = {}) {
  const errors = {}
  const name = String(form.name || '').trim()
  if (!name) errors.name = 'Escribe el alimento'
  else if (name.length > LIMITS.text) errors.name = `Máximo ${LIMITS.text} caracteres`
  const grams = num(form.grams)
  if (grams === null || Number.isNaN(grams) || grams <= 0 || grams > 3000) errors.grams = 'Porción: entre 1 y 3000 g'
  const vals = {}
  for (const m of MACROS) {
    const v = num(form[m.key])
    if (v === null) { vals[m.key] = 0; continue }
    if (Number.isNaN(v) || v < 0 || v > (m.key === 'kcal' ? 10000 : 1000)) errors[m.key] = `${m.label}: número válido`
    else vals[m.key] = m.key === 'kcal' ? Math.round(v) : r1(v)
  }
  if (!errors.kcal && !vals.kcal && (vals.protein || vals.carbs || vals.fat)) vals.kcal = kcalFromMacros(vals)
  return { item: { food: null, name, grams, ...vals }, errors }
}

// Objetivos del día desde el formulario; vacío = sin objetivo para ese macro.
export function parseTargets(form = {}) {
  const errors = {}, targets = {}
  for (const m of MACROS) {
    const v = num(form[m.key])
    if (v === null) continue
    if (Number.isNaN(v) || v <= 0 || v > (m.key === 'kcal' ? 10000 : 1000)) errors[m.key] = `${m.label}: número válido`
    else targets[m.key] = m.key === 'kcal' ? Math.round(v) : r1(v)
  }
  return { targets, errors }
}

// Deja el plan listo para guardar: sin comidas vacías de nombre, textos recortados y dentro de
// los límites que también exige la base (0009).
export function cleanPlan({ targets = {}, meals = [], notes = '' } = {}) {
  const out = meals.slice(0, LIMITS.meals).map(m => ({
    name: String(m.name || '').trim().slice(0, LIMITS.text) || 'Comida',
    time: /^\d{2}:\d{2}$/.test(m.time || '') ? m.time : '',
    items: (m.items || []).slice(0, LIMITS.items).map(it => ({
      food: it.food || null, name: String(it.name || '').trim().slice(0, LIMITS.text), grams: Number(it.grams) || 0,
      kcal: Math.round(Number(it.kcal) || 0), protein: r1(Number(it.protein) || 0), carbs: r1(Number(it.carbs) || 0), fat: r1(Number(it.fat) || 0),
    })).filter(it => it.name),
  }))
  return { targets, meals: out, notes: String(notes || '').trim().slice(0, LIMITS.notes) }
}

// Comidas con las que arranca una dieta nueva.
export const starterMeals = () => [
  { name: 'Desayuno', time: '07:00', items: [] },
  { name: 'Merienda', time: '10:00', items: [] },
  { name: 'Almuerzo', time: '13:00', items: [] },
  { name: 'Merienda', time: '16:30', items: [] },
  { name: 'Cena', time: '19:30', items: [] },
]

// Búsqueda sin acentos ni mayúsculas en la lista de alimentos.
const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export function searchFoods(q, limit = 8) {
  const words = fold(q).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return FOODS.filter(f => words.every(w => fold(f.name).includes(w))).slice(0, limit)
}

// ---- Plantillas -------------------------------------------------------------------------------
// Puntos de partida que el entrenador carga y ajusta: [comida, hora, [[alimento, gramos], …]].
const T = (name, time, items) => ({ name, time, items })
export const DIET_TEMPLATES = [
  { key: 'deficit', label: 'Déficit · ~1.700 kcal', meals: [
    T('Desayuno', '07:00', [['huevo', 100], ['arepa', 90], ['queso-blanco', 30], ['cafe', 240]]),
    T('Merienda', '10:00', [['yogur-griego', 170], ['fresas', 150]]),
    T('Almuerzo', '13:00', [['pollo', 130], ['arroz', 120], ['caraotas', 85], ['ensalada', 150], ['aceite-oliva', 7]]),
    T('Merienda', '16:30', [['manzana', 180], ['almendras', 18]]),
    T('Cena', '19:30', [['pescado', 150], ['batata', 150], ['brocoli', 155]]),
  ] },
  { key: 'mantenimiento', label: 'Mantenimiento · ~2.600 kcal', meals: [
    T('Desayuno', '07:00', [['huevo', 100], ['arepa', 180], ['queso-blanco', 30], ['cafe', 240]]),
    T('Merienda', '10:00', [['yogur-griego', 170], ['cambur', 120], ['avena', 40]]),
    T('Almuerzo', '13:00', [['res-magra', 150], ['arroz', 160], ['caraotas', 170], ['platano', 100], ['ensalada', 100]]),
    T('Merienda', '16:30', [['pan-integral', 60], ['mani', 16]]),
    T('Cena', '19:30', [['pollo', 150], ['papa', 200], ['vegetales', 150], ['aceite-oliva', 7]]),
  ] },
  { key: 'volumen', label: 'Volumen · ~3.300 kcal', meals: [
    T('Desayuno', '06:30', [['avena', 60], ['leche-entera', 240], ['cambur', 120], ['mani', 16]]),
    T('Merienda', '10:00', [['arepa', 90], ['huevo', 100], ['queso-blanco', 30]]),
    T('Almuerzo', '13:00', [['carne-molida', 150], ['arroz', 240], ['caraotas', 170], ['platano', 100]]),
    T('Pre-entreno', '16:30', [['pan-integral', 60], ['mani', 16], ['cambur', 120]]),
    T('Post-entreno', '19:00', [['whey', 30], ['leche-desc', 240]]),
    T('Cena', '20:30', [['pollo', 180], ['pasta', 210], ['vegetales', 150], ['aceite-oliva', 7]]),
  ] },
]

// Las comidas de una plantilla, con cada alimento ya calculado; y objetivos redondeados a sus totales.
export function templatePlan(key) {
  const t = DIET_TEMPLATES.find(x => x.key === key)
  if (!t) return null
  const meals = t.meals.map(m => ({ name: m.name, time: m.time, items: m.items.map(([id, g]) => itemFromFood(foodById(id), g)) }))
  const tot = dayTotals(meals)
  const r5 = v => Math.round(v / 5) * 5
  return { meals, targets: { kcal: Math.round(tot.kcal / 50) * 50, protein: r5(tot.protein), carbs: r5(tot.carbs), fat: r5(tot.fat) } }
}
