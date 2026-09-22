import { describe, it, expect } from 'vitest'
import { parsePlanResponse, matchExercise } from './plan-ai.js'

describe('parsePlanResponse', () => {
  it('parses pure JSON output', () => {
    const raw = JSON.stringify({
      routines: [
        {
          name: 'Push Day',
          dayOfWeek: 1,
          emoji: 'figureStrength',
          exercises: [
            {
              rawName: 'Wyciskanie sztangi leżąc',
              searchQuery: 'barbell bench press',
              bp: 'chest',
              sets: 4,
              reps: 8,
              weight: 80,
              isSupersetNext: false
            }
          ]
        }
      ]
    })
    const res = parsePlanResponse(raw)
    expect(res.routines).toHaveLength(1)
    expect(res.routines[0].name).toBe('Push Day')
    expect(res.routines[0].dayOfWeek).toBe(1)
    expect(res.routines[0].exercises).toHaveLength(1)
    expect(res.routines[0].exercises[0].sets).toBe(4)
    expect(res.routines[0].exercises[0].reps).toBe(8)
    expect(res.routines[0].exercises[0].weight).toBe(80)
  })

  it('parses fenced markdown JSON output', () => {
    const raw = `Here is the parsed workout plan:
\`\`\`json
{
  "routines": [
    {
      "name": "Klatka i Triceps",
      "dayOfWeek": 3,
      "emoji": "arm",
      "exercises": [
        {
          "rawName": "WL 4x8-10 75kg",
          "searchQuery": "barbell bench press",
          "bp": "chest",
          "sets": 4,
          "reps": 8,
          "weight": 75,
          "isSupersetNext": true
        },
        {
          "rawName": "Pompki na poręczach",
          "searchQuery": "chest dip",
          "bp": "upper arms",
          "sets": 3,
          "reps": 12,
          "weight": 0,
          "isSupersetNext": false
        }
      ]
    }
  ]
}
\`\`\``
    const res = parsePlanResponse(raw)
    expect(res.routines).toHaveLength(1)
    expect(res.routines[0].exercises).toHaveLength(2)
    expect(res.routines[0].exercises[0].isSupersetNext).toBe(true)
    expect(res.routines[0].exercises[1].isSupersetNext).toBe(false)
  })

  it('parses routines with multiple days and ranges', () => {
    const raw = JSON.stringify({
      routines: [
        {
          name: 'Dzień 1: Klatka i Triceps',
          dayOfWeek: 1,
          exercises: [
            { rawName: 'WL 4x8-10', searchQuery: 'barbell bench press', sets: 4, reps: 8, weight: 70 },
            { rawName: 'Francuz 3x10-12', searchQuery: 'barbell skull crusher', sets: 3, reps: 10, weight: 30 }
          ]
        },
        {
          name: 'Dzień 2: Plecy i Biceps',
          dayOfWeek: 3,
          exercises: [
            { rawName: 'Martwy ciąg 5x5', searchQuery: 'barbell deadlift', sets: 5, reps: 5, weight: 120 },
            { rawName: 'Podciąganie 4x8', searchQuery: 'pull-up', sets: 4, reps: 8, weight: 0 }
          ]
        }
      ]
    })
    const res = parsePlanResponse(raw)
    expect(res.routines).toHaveLength(2)
    expect(res.routines[0].dayOfWeek).toBe(1)
    expect(res.routines[1].dayOfWeek).toBe(3)
    expect(res.routines[1].exercises[0].weight).toBe(120)
  })

  it('clamps invalid or missing numbers to sensible defaults', () => {
    const raw = JSON.stringify({
      routines: [
        {
          name: '',
          dayOfWeek: 99, // invalid day
          emoji: 'invalid_emoji',
          exercises: [
            {
              rawName: '',
              sets: -5,
              reps: 0,
              weight: -10
            }
          ]
        }
      ]
    })
    const res = parsePlanResponse(raw)
    expect(res.routines[0].dayOfWeek).toBeNull()
    expect(res.routines[0].emoji).toBe('figureStrength')
    expect(res.routines[0].exercises[0].sets).toBe(1)
    expect(res.routines[0].exercises[0].reps).toBe(10)
    expect(res.routines[0].exercises[0].weight).toBe(0)
  })

  it('throws an error on non-JSON response', () => {
    expect(() => parsePlanResponse('Sorry, I cannot parse this plan')).toThrow()
  })
})

describe('matchExercise', () => {
  const mockDb = [
    { id: '0025', n: 'barbell bench press', bp: 'chest', eq: 'barbell' },
    { id: '0314', n: 'incline dumbbell bench press', bp: 'chest', eq: 'dumbbell' },
    { id: '0043', n: 'barbell full squat', bp: 'upper legs', eq: 'barbell' },
    { id: '0032', n: 'barbell deadlift', bp: 'back', eq: 'barbell' },
    { id: '0652', n: 'pull-up', bp: 'back', eq: 'body weight' },
    { id: '0060', n: 'barbell lying triceps extension skull crusher', bp: 'upper arms', eq: 'barbell' }
  ]

  it('matches via common alias', () => {
    const res = matchExercise({ searchQuery: 'bench press', rawName: 'WL', bp: 'chest' }, mockDb)
    expect(res.unmatched).toBe(false)
    expect(res.matched.id).toBe('0025')
  })

  it('matches via exact name', () => {
    const res = matchExercise({ searchQuery: 'barbell full squat', rawName: 'Przysiady', bp: 'upper legs' }, mockDb)
    expect(res.unmatched).toBe(false)
    expect(res.matched.id).toBe('0043')
  })

  it('matches via custom user exercise', () => {
    const custom = [{ id: 'custom-1', n: 'Moje autorskie wznosy', bp: 'shoulders' }, ...mockDb]
    const res = matchExercise({ searchQuery: 'some query', rawName: 'Moje autorskie wznosy', bp: 'shoulders' }, custom)
    expect(res.unmatched).toBe(false)
    expect(res.matched.id).toBe('custom-1')
  })

  it('marks unknown exercises as unmatched and suggests alternatives', () => {
    const res = matchExercise({ searchQuery: 'super strange machine movement xyz', rawName: 'Dziwna maszyna', bp: 'chest' }, mockDb)
    expect(res.unmatched).toBe(true)
    expect(res.candidates.length).toBeGreaterThan(0)
    expect(res.candidates[0].bp).toBe('chest')
  })
})
