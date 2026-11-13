import { describe, expect, it } from 'vitest'
import { decode, encode, encodeUrl, EXPORT_PREFIX, MAX_NODES } from './codec.ts'

describe('tree code v6', () => {
  it('round-trips an allocation', () => {
    const nodes = [29045, 31, 85, 60730, 14744]
    const { nodes: back, variants } = decode(encode({ nodes, variants: {} }))
    expect(new Set(back)).toEqual(new Set(nodes))
    expect(variants).toEqual({})
  })

  it('round-trips multiple-choice variant selections', () => {
    const nodes = [712, 31]
    const variants = { 712: 17864 }
    const out = decode(encode({ nodes, variants }))
    expect(new Set(out.nodes)).toEqual(new Set(nodes))
    expect(out.variants).toEqual(variants)
  })

  it('drops variant choices for nodes that are not allocated', () => {
    // A notable deallocated after its option was chosen must not leak into the link.
    const out = decode(encode({ nodes: [31], variants: { 712: 17864 } }))
    expect(out.variants).toEqual({})
  })

  it('writes the documented header', () => {
    const bytes = atob(encode({ nodes: [1], variants: {} }).replace(/-/g, '+').replace(/_/g, '/'))
    const b = [...bytes].map((c) => c.charCodeAt(0))
    expect(b.slice(0, 6)).toEqual([0, 0, 0, 6, 0, 0]) // version 6, class 0, ascendancy 0
    expect(b[6]).toBe(1) // nodeCount
    expect(b.slice(7, 9)).toEqual([0, 1]) // node id 1, big-endian
    expect(b[9]).toBe(0) // extendedNodeCount
    expect(b[10]).toBe(0) // masteryEffectCount
  })

  it('sorts nodes and removes duplicates', () => {
    const a = encode({ nodes: [500, 12, 500, 3], variants: {} })
    const b = encode({ nodes: [3, 12, 500], variants: {} })
    expect(a).toBe(b)
  })

  it('accepts a full pathofexile.com url', () => {
    const url = encodeUrl({ nodes: [31, 85], variants: {} })
    expect(url.startsWith(EXPORT_PREFIX)).toBe(true)
    expect(new Set(decode(url).nodes)).toEqual(new Set([31, 85]))
  })

  it('accepts the non-fullscreen url form and a trailing slash', () => {
    const code = encode({ nodes: [31, 85], variants: {} })
    const out = decode(`https://www.pathofexile.com/atlas-skill-tree/${code}/`)
    expect(new Set(out.nodes)).toEqual(new Set([31, 85]))
  })

  it('ignores a query string', () => {
    const code = encode({ nodes: [31], variants: {} })
    expect(decode(`https://www.pathofexile.com/atlas-skill-tree/${code}?ver=3.30`).nodes).toEqual([31])
  })

  it('rejects a node count above the single-byte limit', () => {
    const nodes = Array.from({ length: MAX_NODES + 1 }, (_, i) => i + 1)
    expect(() => encode({ nodes, variants: {} })).toThrow(/at most/)
  })

  it('reports unreadable input rather than throwing something opaque', () => {
    expect(() => decode('')).toThrow(/tree code or an Atlas tree link/)
    expect(() => decode('not a code!!')).toThrow(/tree code or an Atlas tree link/)
  })

  it('rejects an unsupported version', () => {
    // version 5, class 0, ascendancy 0, no nodes
    const bytes = [0, 0, 0, 5, 0, 0, 0]
    const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_')
    expect(() => decode(code)).toThrow(/version 5/)
  })
})
