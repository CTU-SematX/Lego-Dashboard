/**
 * Browser-side NGSI-LD Client
 *
 * Lightweight client for fetching NGSI-LD entities directly from browser.
 * Uses native fetch API for minimal bundle size.
 *
 * Headers used:
 * - Fiware-Service: Multi-tenancy header (Orion-LD also accepts NGSILD-Tenant)
 * - Fiware-ServicePath: Optional hierarchical scope
 * - Link: @context reference for response expansion
 * - Accept: application/json for compacted responses
 */

import { NGSI_LD_CORE_CONTEXT, buildLinkHeader } from './client'

export interface NgsiBrowserClientConfig {
  brokerUrl: string
  sourceId?: string // Source ID for server-side API fetching (recommended for HTTPS sites)
  proxyUrl?: string // Deprecated: Optional HTTPS proxy URL to avoid mixed content errors
  tenant?: string
  servicePath?: string
  contextUrl?: string
}

export interface NgsiEntity {
  id: string
  type: string
  [key: string]: unknown
}

export interface QueryEntitiesOptions {
  type?: string
  ids?: string[] // Specific entity IDs to filter
  q?: string // NGSI-LD query string
  attrs?: string[] // Attributes to return
  limit?: number
  offset?: number
}

export class NgsiError extends Error {
  status: number
  code?: string
  detail?: string

  constructor(message: string, status: number, code?: string, detail?: string) {
    super(message)
    this.name = 'NgsiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

/**
 * Browser-side NGSI-LD client using native fetch.
 * Suitable for client components that need direct broker access.
 */
export class NgsiBrowserClient {
  private config: NgsiBrowserClientConfig

  constructor(config: NgsiBrowserClientConfig) {
    this.config = {
      ...config,
      contextUrl: config.contextUrl || NGSI_LD_CORE_CONTEXT,
    }
  }

  /**
   * Build common headers for all requests
   */
  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/json',
      Link: buildLinkHeader(this.config.contextUrl!),
    }

    if (this.config.tenant) {
      headers['Fiware-Service'] = this.config.tenant
    }

    if (this.config.servicePath) {
      headers['Fiware-ServicePath'] = this.config.servicePath
    }

    return headers
  }

  /**
   * Handle response and throw NgsiError if not ok
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorData: { type?: string; title?: string; detail?: string } = {}
      try {
        errorData = await response.json()
      } catch {
        // Response might not be JSON
      }

      throw new NgsiError(
        errorData.title || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData.type,
        errorData.detail,
      )
    }

    return response.json()
  }

  /**
   * Build URL - uses server API if sourceId is set, proxy if proxyUrl set, otherwise direct broker URL
   */
  private buildUrl(path: string, params?: URLSearchParams): string {
    if (this.config.proxyUrl) {
      // Use proxy endpoint (legacy approach)
      const proxyUrl = new URL(this.config.proxyUrl)
      proxyUrl.searchParams.set('broker', this.config.brokerUrl)
      proxyUrl.searchParams.set('path', path)
      if (params && params.toString()) {
        proxyUrl.searchParams.set('params', params.toString())
      }
      return proxyUrl.toString()
    } else {
      // Direct broker access
      const url = new URL(path, this.config.brokerUrl)
      if (params) {
        params.forEach((value, key) => url.searchParams.set(key, value))
      }
      return url.toString()
    }
  }

  /**
   * Build server API URL for entity queries (bypasses mixed content issues)
   */
  private buildApiUrl(entityType: string, entityIds?: string[]): string {
    const apiUrl = new URL('/api/ngsi/entities', window.location.origin)
    apiUrl.searchParams.set('sourceId', this.config.sourceId!)
    apiUrl.searchParams.set('type', entityType)
    if (entityIds && entityIds.length > 0) {
      apiUrl.searchParams.set('ids', entityIds.join(','))
    }
    if (this.config.tenant) {
      apiUrl.searchParams.set('tenant', this.config.tenant)
    }
    if (this.config.servicePath) {
      apiUrl.searchParams.set('servicePath', this.config.servicePath)
    }
    if (this.config.contextUrl) {
      apiUrl.searchParams.set('contextUrl', this.config.contextUrl)
    }
    return apiUrl.toString()
  }

  /**
   * GET single entity by ID
   *
   * @param entityId - Full entity URN (e.g., "urn:ngsi-ld:WeatherObserved:006")
   * @param options - Optional: attrs to filter attributes
   */
  async getEntity(entityId: string, options?: { attrs?: string[] }): Promise<NgsiEntity> {
    const params = new URLSearchParams()
    if (options?.attrs?.length) {
      params.set('attrs', options.attrs.join(','))
    }

    const url = this.buildUrl(`/ngsi-ld/v1/entities/${encodeURIComponent(entityId)}`, params)

    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    })

    return this.handleResponse<NgsiEntity>(response)
  }

  /**
   * Query multiple entities
   *
   * @param options - Query parameters
   */
  async queryEntities(options?: QueryEntitiesOptions): Promise<NgsiEntity[]> {
    // Use server-side API if sourceId is provided (recommended for HTTPS sites)
    if (this.config.sourceId && options?.type) {
      const url = this.buildApiUrl(options.type, options.ids)
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })
      return this.handleResponse<NgsiEntity[]>(response)
    }

    // Fall back to direct/proxy access
    const params = new URLSearchParams()

    if (options?.type) {
      params.set('type', options.type)
    }
    if (options?.q) {
      params.set('q', options.q)
    }
    if (options?.attrs?.length) {
      params.set('attrs', options.attrs.join(','))
    }
    if (options?.limit) {
      params.set('limit', String(options.limit))
    }
    if (options?.offset) {
      params.set('offset', String(options.offset))
    }

    const url = this.buildUrl('/ngsi-ld/v1/entities', params)

    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    })

    return this.handleResponse<NgsiEntity[]>(response)
  }
}

/**
 * Create a configured browser client instance
 */
export function createBrowserClient(config: NgsiBrowserClientConfig): NgsiBrowserClient {
  return new NgsiBrowserClient(config)
}
