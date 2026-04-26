import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.jsx'
import { reportStorageKey } from './components/ReportImportMode.jsx'

describe('App report mode', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

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

  it('supports drag and drop import and remembers the last report', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Rapport Markdown' }))

    const markdown = '# Rapport déposé'
    const file = new window.File([markdown], 'rapport-drop.md', { type: 'text/markdown' })

    fireEvent.drop(screen.getByLabelText('Importer un rapport Markdown ou JSON'), {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Rapport déposé' })).toBeInTheDocument()
    })
    expect(window.localStorage.getItem(reportStorageKey)).toContain('rapport-drop.md')
  })

  it('restores the last imported report from local storage', () => {
    window.localStorage.setItem(reportStorageKey, JSON.stringify({
      type: 'markdown',
      name: 'rapport-memoire.md',
      value: '# Rapport mémorisé',
    }))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Rapport Markdown' }))

    expect(screen.getByRole('heading', { name: 'Rapport mémorisé' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'rapport-memoire.md' })).toBeInTheDocument()
  })

  it('rejects unsupported dropped files', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Rapport Markdown' }))

    const file = new window.File(['not a report'], 'image.png', { type: 'image/png' })

    fireEvent.drop(screen.getByLabelText('Importer un rapport Markdown ou JSON'), {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByText('Format non pris en charge. Utilisez un fichier Markdown, texte ou JSON.')).toBeInTheDocument()
    })
  })
})
