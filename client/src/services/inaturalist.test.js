import { describe, expect, it } from 'vitest'
import { computeStats, localPlaceName } from './inaturalist.js'

describe('localPlaceName', () => {
  it('keeps the useful locality instead of the country suffix', () => {
    expect(localPlaceName('Annaba, DZ')).toBe('Annaba')
    expect(localPlaceName('Bordj Bou Arreridj, BB, DZ')).toBe('Bordj Bou Arreridj')
    expect(localPlaceName('Kabylie, Algeria')).toBe('Kabylie')
  })
})

describe('computeStats', () => {
  it('groups observations by localities', () => {
    const stats = computeStats([
      { place_guess: 'Annaba, DZ' },
      { place_guess: 'Annaba, AN, DZ' },
      { place_guess: 'Bordj Bou Arreridj, BB, DZ' },
    ])

    expect(stats.uniquePlaces).toBe(2)
    expect(stats.topPlaces).toEqual([
      ['Annaba', 2],
      ['Bordj Bou Arreridj', 1],
    ])
  })
})
