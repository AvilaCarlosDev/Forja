import { describe, it, expect } from 'vitest'
import {
  MIN_AGE, ADULT_AGE, ageOn, needsGuardian, validateDetails, validateGuardian, guardianBody,
  profileIsComplete, avatarPath, fitSize, todayISO,
} from './forja-profile.js'

const TODAY = '2026-10-06'

describe('ageOn', () => {
  it('counts whole years, the day of the birthday included', () => {
    expect(ageOn('2008-10-06', TODAY)).toBe(18)
    expect(ageOn('2008-10-07', TODAY)).toBe(17)
    expect(ageOn('2008-11-01', TODAY)).toBe(17)
    expect(ageOn('1995-05-20', TODAY)).toBe(31)
  })
  it('handles 29 February', () => {
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17)
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18)
  })
  it('returns null for anything that is not a date', () => {
    expect(ageOn('', TODAY)).toBeNull(); expect(ageOn(null, TODAY)).toBeNull(); expect(ageOn('06/10/2000', TODAY)).toBeNull()
  })
})

describe('needsGuardian', () => {
  it('asks for a guardian under 18 only', () => {
    expect(ADULT_AGE).toBe(18)
    expect(needsGuardian('2008-10-07', TODAY)).toBe(true)
    expect(needsGuardian('2008-10-06', TODAY)).toBe(false)
    expect(needsGuardian('', TODAY)).toBe(false)
  })
})

describe('todayISO', () => {
  it('uses the local calendar day', () => { expect(todayISO(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06') })
})

describe('validateDetails', () => {
  const ok = { name: 'Ana', sex: 'female', birth_date: '1995-05-20' }
  it('accepts a complete adult profile', () => { expect(validateDetails(ok, TODAY)).toEqual({}) })
  it('accepts a minor: the guardian is asked for afterwards', () => {
    expect(validateDetails({ ...ok, birth_date: '2010-01-01' }, TODAY)).toEqual({})
  })
  it(`rejects under ${MIN_AGE}, the future and impossible ages`, () => {
    expect(validateDetails({ ...ok, birth_date: '2016-01-01' }, TODAY).birth_date).toMatch(String(MIN_AGE))
    expect(validateDetails({ ...ok, birth_date: '2026-10-07' }, TODAY).birth_date).toMatch(/futuro/)
    expect(validateDetails({ ...ok, birth_date: '1900-01-01' }, TODAY).birth_date).toBeTruthy()
  })
  it('requires name, sex and date', () => {
    expect(Object.keys(validateDetails({}, TODAY)).sort()).toEqual(['birth_date', 'name', 'sex'])
  })
})

describe('validateGuardian', () => {
  const g = { guardian_name: 'María Pérez', guardian_email: 'maria@example.com', relationship: 'madre', accept: true }
  it('accepts a complete consent', () => { expect(validateGuardian(g)).toEqual({}) })
  it('requires every field and the explicit acceptance', () => {
    expect(Object.keys(validateGuardian({})).sort()).toEqual(['accept', 'guardian_email', 'guardian_name', 'relationship'])
    expect(validateGuardian({ ...g, relationship: 'primo' }).relationship).toBeTruthy()
    expect(validateGuardian({ ...g, accept: false }).accept).toBeTruthy()
  })
  it('sends a clean row', () => {
    expect(guardianBody('u1', { ...g, guardian_name: ' María Pérez ', guardian_email: ' Maria@Example.com' }))
      .toEqual({ user_id: 'u1', guardian_name: 'María Pérez', guardian_email: 'maria@example.com', relationship: 'madre' })
  })
})

describe('profile helpers', () => {
  it('is complete only once onboarded', () => {
    expect(profileIsComplete(null)).toBe(false)
    expect(profileIsComplete({ onboarded_at: null })).toBe(false)
    expect(profileIsComplete({ onboarded_at: '2026-10-06T10:00:00Z' })).toBe(true)
  })
  it('keeps the photo inside the user folder', () => { expect(avatarPath('abc', 5)).toBe('abc/avatar-5.webp') })
  it('shrinks big photos and never enlarges small ones', () => {
    expect(fitSize(4000, 3000)).toEqual({ w: 512, h: 384 })
    expect(fitSize(300, 600)).toEqual({ w: 256, h: 512 })
    expect(fitSize(200, 100)).toEqual({ w: 200, h: 100 })
    expect(fitSize(0, 100)).toBeNull()
  })
})
