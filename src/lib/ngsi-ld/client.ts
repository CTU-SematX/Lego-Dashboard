import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'

export const NGSI_LD_CORE_CONTEXT =
  'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld'

export interface NgsiClientConfig {
  brokerUrl: string
  service?: string
  servicePath?: string
  authToken?: string
}

/**
 * Build Link header for NGSI-LD context
 * Format: <context-url>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"
 */
export function buildLinkHeader(contextUrl: string): string {
  return `<${contextUrl}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`
}

/**
 * Create a base axios client with common headers (Fiware-Service, Fiware-ServicePath, auth)
 * Does NOT set Content-Type or Accept - those are set per-request based on operation
 */
export function createNgsiClient(config: NgsiClientConfig): AxiosInstance {
  const { brokerUrl, service, servicePath, authToken } = config

  const headers: Record<string, string> = {}

  // Only add Fiware-Service if it's a non-empty string
  if (service && service.trim()) {
    headers['Fiware-Service'] = service.trim()
  }

  // Only add Fiware-ServicePath if it's a non-empty string
  if (servicePath && servicePath.trim()) {
    headers['Fiware-ServicePath'] = servicePath.trim()
  }

  if (authToken) {
    headers['X-Auth-Token'] = authToken
  }

  return axios.create({
    baseURL: brokerUrl,
    headers,
    timeout: 10000,
  })
}

/**
 * NGSI-LD Entity operations following the spec:
 * https://ngsi-ld-tutorials.readthedocs.io/en/latest/ngsi-ld-operations.html
 */
export class NgsiLdOperations {
  private client: AxiosInstance
  private contextUrl: string

  constructor(config: NgsiClientConfig, contextUrl: string) {
    this.client = createNgsiClient(config)
    this.contextUrl = contextUrl
  }

  /**
   * CREATE entity - POST /ngsi-ld/v1/entities
   * Uses Content-Type: application/json + Link header (per tutorial examples)
   */
  async createEntity(entity: { id: string; type: string; [key: string]: unknown }): Promise<void> {
    await this.client.post('/ngsi-ld/v1/entities', entity, {
      headers: {
        'Content-Type': 'application/json',
        Link: buildLinkHeader(this.contextUrl),
      },
    })
  }

  /**
   * READ entity - GET /ngsi-ld/v1/entities/{entityId}
   * Uses Accept: application/json + Link header for compacted response
   * Or Accept: application/ld+json (NO Link header) for embedded context
   */
  async getEntity(
    entityId: string,
    options?: { embedContext?: boolean },
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {}

    if (options?.embedContext) {
      // Get response with @context embedded in body
      headers['Accept'] = 'application/ld+json'
      // NO Link header allowed with application/ld+json
    } else {
      // Get compacted response using Link header
      headers['Accept'] = 'application/json'
      headers['Link'] = buildLinkHeader(this.contextUrl)
    }

    const response = await this.client.get(`/ngsi-ld/v1/entities/${encodeURIComponent(entityId)}`, {
      headers,
    })
    return response.data
  }

  /**
   * UPDATE entity attributes - PATCH /ngsi-ld/v1/entities/{entityId}/attrs
   * Uses Content-Type: application/json + Link header
   */
  async updateEntityAttrs(entityId: string, attrs: Record<string, unknown>): Promise<void> {
    await this.client.patch(`/ngsi-ld/v1/entities/${encodeURIComponent(entityId)}/attrs`, attrs, {
      headers: {
        'Content-Type': 'application/json',
        Link: buildLinkHeader(this.contextUrl),
      },
    })
  }

  /**
   * DELETE entity - DELETE /ngsi-ld/v1/entities/{entityId}
   */
  async deleteEntity(entityId: string): Promise<void> {
    await this.client.delete(`/ngsi-ld/v1/entities/${encodeURIComponent(entityId)}`)
  }

  /**
   * Check if entity exists
   */
  async entityExists(entityId: string): Promise<boolean> {
    try {
      await this.client.head(`/ngsi-ld/v1/entities/${encodeURIComponent(entityId)}`)
      return true
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * UPSERT - Create if not exists, update if exists
   */
  async upsertEntity(entity: {
    id: string
    type: string
    [key: string]: unknown
  }): Promise<'created' | 'updated'> {
    const exists = await this.entityExists(entity.id)

    if (exists) {
      // Extract only attributes (exclude id, type)
      const { id: _id, type: _type, ...attrs } = entity
      await this.updateEntityAttrs(entity.id, attrs)
      return 'updated'
    } else {
      await this.createEntity(entity)
      return 'created'
    }
  }
}
