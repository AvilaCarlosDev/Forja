import { describe, it, expect } from 'vitest'
import {
  gymLabel, normalizeSocial, validateGymSuggestion, filterGyms, effectivePlan, clientCanEditMetrics,
  linkSummary, notificationText, metricRow, bmi, latestValues, progress, FREE_CLIENT_LIMIT,
} from './forja-coach.js'

const gyms = [
  { id: 'a', name: 'Gold Stars Gym', branch: 'Sambil Paraguaná', address: 'Terrazas del Sambil' },
  { id: 'b', name: 'Gold Stars Gym', branch: 'Las Virtudes' },
  { id: 'c', name: 'Altitude', branch: null, address: 'C.C. Mediterráneo' },
]

describe('gyms', () => {
  it('labels a branch after the name', () => {
    expect(gymLabel(gyms[0])).toBe('Gold Stars Gym · Sambil Paraguaná')
    expect(gymLabel(gyms[2])).toBe('Altitude')
  })
  it('finds by name, branch or address, ignoring accents and case', () => {
    expect(filterGyms(gyms, 'paraguana').map(g => g.id)).toEqual(['a'])
    expect(filterGyms(gyms, 'MEDITERRÁNEO').map(g => g.id)).toEqual(['c'])
    expect(filterGyms(gyms, 'gold').length).toBe(2)
    expect(filterGyms(gyms, '  ')).toBe(gyms)
  })
})

describe('normalizeSocial', () => {
  it('turns an @handle into an Instagram profile', () => {
    expect(normalizeSocial('@nltc_gym')).toBe('https://www.instagram.com/nltc_gym/')
  })
  it('cleans pasted links', () => {
    expect(normalizeSocial('instagram.com/altitudepf')).toBe('https://www.instagram.com/altitudepf/')
    expect(normalizeSocial('https://m.facebook.com/GoldStarsGym/?ref=x')).toBe('https://facebook.com/GoldStarsGym/')
    expect(normalizeSocial('https://x.com/forja')).toBe('https://x.com/forja/')
  })
  it('rejects anything that is not a social profile', () => {
    expect(normalizeSocial('https://example.com/gym')).toBeNull()
    expect(normalizeSocial('https://www.instagram.com/')).toBeNull()
    expect(normalizeSocial('mi gym')).toBeNull()
    expect(normalizeSocial('')).toBeNull()
  })
})

describe('validateGymSuggestion', () => {
  it('needs a name and a proof: social network or logo', () => {
    expect(validateGymSuggestion({ name: 'Gym Nuevo', social: '@gymnuevo' })).toEqual({})
    expect(validateGymSuggestion({ name: 'Gym Nuevo', logo: {} })).toEqual({})
    expect(validateGymSuggestion({ name: 'Gym Nuevo' }).proof).toBeTruthy()
    expect(validateGymSuggestion({ social: '@x' }).name).toBeTruthy()
  })
  it('rejects a bad link and a duplicate', () => {
    expect(validateGymSuggestion({ name: 'Gym', social: 'https://example.com/x' }).social).toBeTruthy()
    expect(validateGymSuggestion({ name: 'altitude', social: '@a' }, gyms).name).toMatch(/ya está/)
  })
})

describe('plan and link', () => {
  it('Pro counts only while it has not expired', () => {
    const now = Date.parse('2026-10-06T12:00:00Z')
    expect(effectivePlan({ plan: 'free' }, now)).toBe('free')
    expect(effectivePlan({ plan: 'pro', plan_expires_at: null }, now)).toBe('pro')
    expect(effectivePlan({ plan: 'pro', plan_expires_at: '2026-11-01T00:00:00Z' }, now)).toBe('pro')
    expect(effectivePlan({ plan: 'pro', plan_expires_at: '2026-10-01T00:00:00Z' }, now)).toBe('free')
    expect(effectivePlan(null, now)).toBe('free')
    expect(FREE_CLIENT_LIMIT).toBe(5)
  })
  it('a client with a trainer only reads', () => {
    expect(clientCanEditMetrics(null)).toBe(true)
    expect(clientCanEditMetrics({ status: 'active' })).toBe(false)
  })
  it('splits my active trainer and my pending request', () => {
    const links = [
      { id: 1, client_id: 'me', status: 'ended' },
      { id: 2, client_id: 'me', status: 'active' },
      { id: 3, client_id: 'me', status: 'pending' },
      { id: 4, client_id: 'other', status: 'active' },
    ]
    expect(linkSummary(links, 'me')).toEqual({ active: links[1], pending: links[2] })
    expect(linkSummary([], 'me')).toEqual({ active: null, pending: null })
  })
  it('words every notification', () => {
    expect(notificationText({ kind: 'link_request', actor_name: 'Ana' })).toBe('Ana quiere entrenar contigo')
    expect(notificationText({ kind: 'link_accepted', actor_name: 'Luis' })).toMatch('aceptó')
    expect(notificationText({ kind: 'nueva' })).toBe('Novedad en tu cuenta')
  })
})

describe('metrics', () => {
  const today = '2026-10-06'
  it('builds a row from the form, commas included', () => {
    const { row, errors } = metricRow({ weight_kg: '68,5', height_cm: '165', waist: '72', note: ' Inicio ' }, 'c1', today)
    expect(errors).toEqual({})
    expect(row).toEqual({ client_id: 'c1', measured_on: today, weight_kg: 68.5, height_cm: 165, measurements: { waist: 72 }, note: 'Inicio' })
  })
  it('rejects out-of-range values, the future and an empty form', () => {
    expect(metricRow({ weight_kg: '900' }, 'c1', today).errors.weight_kg).toBeTruthy()
    expect(metricRow({ body_fat_pct: 'abc' }, 'c1', today).errors.body_fat_pct).toBeTruthy()
    expect(metricRow({ weight_kg: '70', measured_on: '2026-10-07' }, 'c1', today).errors.measured_on).toBeTruthy()
    expect(metricRow({}, 'c1', today).errors.form).toBeTruthy()
  })
  it('computes BMI', () => {
    expect(bmi(68.5, 165)).toBe(25.2)
    expect(bmi(null, 165)).toBeNull()
  })
  const rows = [
    { measured_on: '2026-08-01', weight_kg: 72, height_cm: 165, body_fat_pct: 30 },
    { measured_on: '2026-09-01', weight_kg: 70 },
    { measured_on: '2026-10-01', weight_kg: 68.5, body_fat_pct: 27.5 },
  ]
  it('keeps the last known value of every field', () => {
    expect(latestValues(rows)).toEqual({
      weight_kg: { value: 68.5, on: '2026-10-01' },
      height_cm: { value: 165, on: '2026-08-01' },
      body_fat_pct: { value: 27.5, on: '2026-10-01' },
    })
  })
  it('compares the first and the last measurement', () => {
    expect(progress(rows)).toEqual({
      weight_kg: { first: 72, last: 68.5, diff: -3.5 },
      body_fat_pct: { first: 30, last: 27.5, diff: -2.5 },
    })
  })
})
