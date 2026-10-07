import { describe, expect, it } from 'vitest'
import { cleanRoutine, toLocalRoutine, mergeAssigned, isAssigned, daysText } from './forja-routines.js'

const A = { id: 'a1', name: 'Empuje', days: [1, 4], note: 'Calentar 10 min', updated_at: '2026-10-07T10:00:00Z',
  exercises: [{ id: '0025', sets: 4, reps: 8, weight: 60 }, { id: '0047', sets: 3, reps: 10, weight: 20, note: 'bajar lento' }] }

describe('forja-routines — formulario del coach', () => {
  it('cleans a valid routine', () => {
    const { routine, errors } = cleanRoutine({ name: ' Empuje ', days: [4, 1, 1], note: ' ',
      exercises: [{ id: '0025', sets: '4', reps: '8', weight: '60,5' }, { id: '0047', sets: 3, reps: 10, weight: '' }] })
    expect(errors).toEqual({})
    expect(routine).toEqual({ name: 'Empuje', days: [1, 4], note: null,
      exercises: [{ id: '0025', sets: 4, reps: 8, weight: 60.5 }, { id: '0047', sets: 3, reps: 10, weight: 0 }] })
  })

  it('needs a name, at least one exercise and sensible numbers', () => {
    expect(Object.keys(cleanRoutine({}).errors).sort()).toEqual(['exercises', 'name'])
    expect(cleanRoutine({ name: 'x', exercises: [{ id: '1', sets: 0, reps: 8 }] }).errors.ex0).toBeTruthy()
    expect(cleanRoutine({ name: 'x', exercises: [{ id: '1', sets: 3, reps: 8, weight: -5 }] }).errors.ex0).toBeTruthy()
  })

  it('names the days in order', () => {
    expect(daysText([4, 1, 0])).toBe('Lun · Jue · Dom')
    expect(daysText([])).toBe('Sin día fijo')
  })
})

describe('forja-routines — en la app del cliente', () => {
  it('becomes an openGym routine trained exactly as the coach set it', () => {
    const r = toLocalRoutine(A, 'Andrea')
    expect(r).toMatchObject({ id: 'coach-a1', name: 'Empuje', excludeFromProgression: true, assigned: { by: 'Andrea', days: [1, 4], note: 'Calentar 10 min' } })
    expect(r.ex[1]).toEqual({ id: '0047', sets: 3, reps: 10, weight: 20, note: 'bajar lento' })
    expect(isAssigned(r)).toBe(true)
  })

  it('merges into the plan and the week without touching the client own routines', () => {
    const S = { routines: [{ id: 'mine', name: 'Mía', ex: [] }], week: { 1: ['mine'], 3: 'mine' } }
    expect(mergeAssigned(S, [A], 'Andrea')).toBe(1)
    expect(S.routines.map(r => r.id)).toEqual(['mine', 'coach-a1'])
    expect(S.week).toEqual({ 1: ['mine', 'coach-a1'], 3: ['mine'], 4: ['coach-a1'] })
    // sin cambios: no cuenta como cambio
    expect(mergeAssigned(S, [A], 'Andrea')).toBe(0)
    // el coach la mueve al martes y le cambia el peso
    mergeAssigned(S, [{ ...A, days: [2], exercises: [{ id: '0025', sets: 5, reps: 5, weight: 70 }] }], 'Andrea')
    expect(S.week).toEqual({ 1: ['mine'], 2: ['coach-a1'], 3: ['mine'] })
    expect(S.routines[1].ex).toEqual([{ id: '0025', sets: 5, reps: 5, weight: 70 }])
    // el coach la borra
    mergeAssigned(S, [], 'Andrea')
    expect(S.routines.map(r => r.id)).toEqual(['mine'])
    expect(S.week).toEqual({ 1: ['mine'], 3: ['mine'] })
  })
})

describe('forja-routines — al entrenar', () => {
  it('the session opens with the coach weight, reps and sets, even with heavier history', async () => {
    const { buildSessionEntries } = await import('./session-start.js')
    const r = toLocalRoutine(A, 'Andrea')
    // historial que la progresión automática habría subido
    const st = { unit: 'kg', workouts: [{ d: '2026-10-01', start: 1, entries: [{ id: '0025', target: { sets: 4, reps: 8, weight: 80 }, sets: [{ w: 80, r: 8, done: true }] }] }],
      exWeights: { '0025': { w: 80, d: '2026-10-01' } }, routines: [r], week: {}, dayPlan: {} }
    const [bench] = buildSessionEntries(st, r)
    expect(bench.noProg).toBe(true)
    expect(bench.target).toMatchObject({ sets: 4, reps: 8, weight: 60 })
    const work = bench.sets.filter(s => !s.warm && !s.wu)
    expect(work.at(-1)).toMatchObject({ w: 60, r: 8 })
  })
})
