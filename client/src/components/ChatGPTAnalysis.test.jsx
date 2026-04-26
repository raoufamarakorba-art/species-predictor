import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChatGPTAnalysis from './ChatGPTAnalysis.jsx'

const defaultProps = {
  observations: [
    {
      id: 1,
      observed_on: '2026-04-26',
      quality_grade: 'research',
      place_guess: 'Algeria',
      geojson: { coordinates: [3.05, 36.75] },
      taxon: {
        id: 49995,
        name: 'Syrphidae',
        preferred_common_name: 'Hover flies',
      },
      user: { login: 'observer' },
    },
  ],
  taxon: {
    id: 49995,
    name: 'Syrphidae',
    rank: 'family',
    preferred_common_name: 'Hover flies',
  },
  stats: {
    total: 1202,
    sortedYears: ['2026'],
    topPlaces: [],
  },
  datasetSummary: {
    total: 1,
    withCoordinates: 1,
  },
  speciesName: 'Syrphidae',
}

function analysisInput(container) {
  const input = container.querySelector('input[type="file"]')
  expect(input).toBeInTheDocument()
  return input
}

describe('ChatGPTAnalysis', () => {
  it('renders imported Markdown reports with GFM tables', async () => {
    const { container } = render(<ChatGPTAnalysis {...defaultProps} />)
    const markdown = [
      '# Rapport test',
      '',
      '## Qualité des données',
      '',
      '| Indicateur | Valeur |',
      '|---|---|',
      '| Observations | 200 |',
      '',
      '> Résultat exploratoire.',
    ].join('\n')
    const file = new window.File([markdown], 'rapport.md', { type: 'text/markdown' })

    fireEvent.change(analysisInput(container), { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Rapport test' })).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: 'Qualité des données' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Indicateur' })).toBeInTheDocument()
    expect(screen.getByText('Résultat exploratoire.')).toBeInTheDocument()
  })

  it('keeps structured rendering for imported JSON analysis', async () => {
    const { container } = render(<ChatGPTAnalysis {...defaultProps} />)
    const file = new window.File([
      JSON.stringify({
        dataQuality: 'Research grade only for SDM.',
        recommendations: ['Remove duplicates', 'Thin spatially'],
      }),
    ], 'analysis.json', { type: 'application/json' })

    fireEvent.change(analysisInput(container), { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Data Quality' })).toBeInTheDocument()
    })
    expect(screen.getByText('Research grade only for SDM.')).toBeInTheDocument()
    expect(screen.getByText(/Remove duplicates/)).toBeInTheDocument()
    expect(screen.getByText(/Thin spatially/)).toBeInTheDocument()
  })
})
