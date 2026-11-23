import { describe, expect, it } from 'vitest'

import { getBrandAssets } from '../src/theme/brandAssets'

describe('brandAssets', () => {
  it('devuelve activos de isotipo y wordmark distintos para modo claro y modo oscuro', () => {
    const light = getBrandAssets(false)
    const dark = getBrandAssets(true)

    expect(light.isotipo).toBeDefined()
    expect(light.wordmark).toBeDefined()
    expect(dark.isotipo).toBeDefined()
    expect(dark.wordmark).toBeDefined()

    expect(light.isotipo).not.toEqual(dark.isotipo)
    expect(light.wordmark).not.toEqual(dark.wordmark)
  })
})
