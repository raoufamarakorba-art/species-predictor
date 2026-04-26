import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.jsx'

describe('App report mode', () => {
  it('imports a Markdown report without running an iNaturalist analysis first', async () => {
    const { container } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Rapport Markdown' }))

    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()

    const markdown = [
      '# Rapport direct',
      '',
      '| Section | Statut |',
      '|---|---|',
      '| Import | OK |',
    ].join('\n')
    const file = new window.File([markdown], 'rapport-direct.md', { type: 'text/markdown' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Rapport direct' })).toBeInTheDocument()
    })
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Récupération des données iNaturalist…')).not.toBeInTheDocument()
  })
})
