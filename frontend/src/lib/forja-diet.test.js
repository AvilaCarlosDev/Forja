import { describe, expect, it } from 'vitest'
import {
  FOODS, foodById, itemFromFood, unitsText, mealTotals, dayTotals, versusTargets,
  customItem, parseTargets, cleanPlan, searchFoods, kcalFromMacros, LIMITS,
} from './forja-diet.js'

describe('forja-diet — alimentos', () => {
  it('every food has an id, a name and plausible values per 100 g', () => {
    const ids = new Set()
    for (const f of FOODS) {
      expect(ids.has(f.id), f.id).toBe(false); ids.add(f.id)
      expect(f.name).toBeTruthy()
      expect(f.p + f.c + f.f, f.id).toBeLessThanOrEqual(100)
      // las kcal declaradas no se alejan de 4/4/9 más de lo que explican fibra y redondeo
      const est = kcalFromMacros({ protein: f.p, carbs: f.c, fat: f.f })
      expect(Math.abs(est - f.kcal), f.id).toBeLessThanOrEqual(Math.max(25, f.kcal * 0.15))
    }
  })

  it('scales a food to its portion', () => {
    const it2 = itemFromFood(foodById('huevo'), 100)
    expect(it2).toEqual({ food: 'huevo', name: 'Huevo entero', grams: 100, kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 })
    expect(itemFromFood(foodById('arroz'), 160)).toMatchObject({ kcal: 208, protein: 4.3, carbs: 44.8, fat: 0.5 })
  })

  it('says the portion in household units', () => {
    expect(unitsText(itemFromFood(foodById('huevo'), 100))).toBe('≈ 2 huevos')
    expect(unitsText(itemFromFood(foodById('arepa'), 90))).toBe('≈ 1 arepa mediana')
    expect(unitsText(itemFromFood(foodById('arroz'), 240))).toBe('≈ 1,5 tazas')
    expect(unitsText(itemFromFood(foodById('pollo'), 150))).toBe('')
    expect(unitsText({ food: null, grams: 100 })).toBe('')
  })

  it('finds foods without accents or case', () => {
    expect(searchFoods('platano').map(f => f.id)).toEqual(['platano'])
    expect(searchFoods('ARROZ').map(f => f.id)).toEqual(['arroz', 'arroz-integral'])
    expect(searchFoods('pollo plancha').map(f => f.id)).toEqual(['pollo'])
    expect(searchFoods('  ')).toEqual([])
  })
})

describe('forja-diet — totales', () => {
  const meals = [
    { name: 'Desayuno', items: [itemFromFood(foodById('huevo'), 100), itemFromFood(foodById('arepa'), 90)] },
    { name: 'Almuerzo', items: [itemFromFood(foodById('pollo'), 150), itemFromFood(foodById('arroz'), 160)] },
  ]

  it('adds each meal and the day', () => {
    expect(mealTotals(meals[0])).toEqual({ kcal: 314, protein: 16.2, carbs: 36.7, fat: 10.4 })
    expect(dayTotals(meals)).toEqual({ kcal: 770, protein: 67, carbs: 81.5, fat: 16.3 })
    expect(dayTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })

  it('compares the day against the targets', () => {
    const v = versusTargets(dayTotals(meals), { kcal: 1540, protein: 120 })
    expect(v.kcal).toEqual({ total: 770, target: 1540, pct: 50 })
    expect(v.protein.pct).toBe(56)
    expect(v.carbs).toEqual({ total: 81.5, target: null, pct: null })
  })
})

describe('forja-diet — formularios', () => {
  it('a custom food needs a name and a portion; kcal come from the macros when left empty', () => {
    expect(customItem({}).errors).toMatchObject({ name: expect.any(String), grams: expect.any(String) })
    const { item, errors } = customItem({ name: ' Tequeño horneado ', grams: '40', protein: '5', carbs: '12,5', fat: '6' })
    expect(errors).toEqual({})
    expect(item).toEqual({ food: null, name: 'Tequeño horneado', grams: 40, kcal: 124, protein: 5, carbs: 12.5, fat: 6 })
    expect(customItem({ name: 'x', grams: 10, kcal: '-1' }).errors.kcal).toBeTruthy()
  })

  it('reads the targets and leaves out the empty ones', () => {
    expect(parseTargets({ kcal: '1650', protein: '120,5', carbs: '' })).toEqual({ targets: { kcal: 1650, protein: 120.5 }, errors: {} })
    expect(parseTargets({ kcal: '0' }).errors.kcal).toBeTruthy()
  })

  it('cleans the plan to the limits the database also enforces', () => {
    const many = Array.from({ length: LIMITS.meals + 3 }, (_, i) => ({ name: '', time: i ? '7' : '07:30', items: [{ name: '' }, { name: 'Huevo', kcal: '71.6' }] }))
    const plan = cleanPlan({ meals: many, notes: ' tomar agua ' })
    expect(plan.meals).toHaveLength(LIMITS.meals)
    expect(plan.meals[0]).toEqual({ name: 'Comida', time: '07:30', items: [{ food: null, name: 'Huevo', grams: 0, kcal: 72, protein: 0, carbs: 0, fat: 0 }] })
    expect(plan.meals[1].time).toBe('')
    expect(plan.notes).toBe('tomar agua')
  })
})
