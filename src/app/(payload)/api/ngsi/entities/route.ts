import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * NGSI-LD Entities API Endpoint
 * 
 * Server-side endpoint that fetches entities from NGSI-LD brokers.
 * This bypasses mixed content issues by making HTTP requests from the server.
 * 
 * Usage: /api/ngsi/entities?sourceId=<source-id>&type=<entity-type>&tenant=<tenant>&servicePath=<path>
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const searchParams = req.nextUrl.searchParams
    const sourceId = searchParams.get('sourceId')
    const entityType = searchParams.get('type')
    const entityIds = searchParams.get('ids') // Comma-separated entity IDs to filter
    const tenant = searchParams.get('tenant') || undefined
    const servicePath = searchParams.get('servicePath') || undefined
    const contextUrl = searchParams.get('contextUrl') || undefined

    if (!sourceId) {
      return NextResponse.json(
        { error: 'Missing sourceId parameter' },
        { status: 400 }
      )
    }

    if (!entityType) {
      return NextResponse.json(
        { error: 'Missing type parameter' },
        { status: 400 }
      )
    }

    // Get the source from Payload
    const payload = await getPayload({ config })
    const source = await payload.findByID({
      collection: 'ngsi-sources',
      id: sourceId,
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    const brokerUrl = source.brokerUrl
    if (!brokerUrl) {
      return NextResponse.json(
        { error: 'Source has no broker URL configured' },
        { status: 400 }
      )
    }

    // Build the target URL
    const targetUrl = new URL('/ngsi-ld/v1/entities', brokerUrl)
    targetUrl.searchParams.set('type', entityType)

    // Build headers
    const headers: HeadersInit = {
      'Accept': 'application/json',
    }

    // Note: Don't send Link header for @context to the broker
    // as it causes type expansion/compaction issues with entities stored using short type names

    // Add tenant/service headers
    if (tenant) {
      headers['Fiware-Service'] = tenant
      headers['NGSILD-Tenant'] = tenant
    }

    if (servicePath) {
      headers['Fiware-ServicePath'] = servicePath
    }

    // Fetch from broker
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[NGSI API] Broker error:', response.status, errorText)
      return NextResponse.json(
        { 
          error: 'Broker request failed',
          status: response.status,
          statusText: response.statusText,
          details: errorText
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Filter by specific entity IDs if provided
    let filteredData = data
    if (entityIds && Array.isArray(data)) {
      const idsToFilter = entityIds.split(',')
      filteredData = data.filter((entity: { id: string }) => idsToFilter.includes(entity.id))
    }

    return NextResponse.json(filteredData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[NGSI API] Error:', error)
    return NextResponse.json(
      { 
        error: 'Request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
