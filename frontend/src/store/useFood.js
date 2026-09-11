// Local-only store for food & macro tracking. Lives entirely in localStorage
// (key 'gym_food_v1') and never touches the synced profile state S — goals and
// the food diary are per-device, so an account / Supabase is not involved.

import { create } from 'zustand'
import { loadFood, saveFood } from '../lib/nutrition.js'

export const useFood = create(set => {
  let current = loadFood()
  return {
    food: current,
    update(mut) {
      const next = JSON.parse(JSON.stringify(current))
      mut(next)
      current = next
      saveFood(next)
      set({ food: next })
    },
    clear() {
      current = { goals: { kcal: 0, p: 0, c: 0, f: 0 }, day: {} }
      saveFood(current)
      set({ food: current })
    }
  }
})
