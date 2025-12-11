import { NextRequest, NextResponse } from 'next/server'

/**
 * NGSI-LD Proxy Endpoint
 * 
 * This proxy forwards requests to HTTP NGSI-LD brokers over HTTPS,
 * solving mixed content issues when the dashboard is served over HTTPS.
 * 
 * Usage: /api/ngsi-proxy?broker=<broker-url>&path=<path>&params=<query-params>
 * 
 * Example:
 * /api/ngsi-proxy?broker=http://localhost:1026&path=/ngsi-ld/v1/entities&params=type=WeatherAlert
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const searchParams = req.nextUrl.searchParams
    const brokerUrl = searchParams.get('broker')
    const path = searchParams.get('path') || '/ngsi-ld/v1/entities'
    const params = searchParams.get('params') || ''

    if (!brokerUrl) {
      return NextResponse.json(
        { error: 'Missing broker URL parameter' },
        { status: 400 }
      )
    }

    // Build the target URL
    const targetUrl = `${brokerUrl}${path}${params ? `?${params}` : ''}`

    // Extract NGSI headers from request
    const headers: HeadersInit = {}
    const ngsildTenant = req.headers.get('ngsild-tenant')
    const ngsildPath = req.headers.get('ngsild-path')
    const fiwareService = req.headers.get('fiware-service')
    const fiwareServicePath = req.headers.get('fiware-servicepath')
    
    if (ngsildTenant) headers['ngsild-tenant'] = ngsildTenant
    if (ngsildPath) headers['ngsild-path'] = ngsildPath
    if (fiwareService) headers['fiware-service'] = fiwareService
    if (fiwareServicePath) headers['fiware-servicepath'] = fiwareServicePath

    // Add Link header if provided
    const link = req.headers.get('link')
    if (link) headers['link'] = link

    // Forward the request to the broker
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
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

    // Return the data with appropriate CORS headers
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, ngsild-tenant, ngsild-path, fiware-service, fiware-servicepath, link',
      },
    })
  } catch (error) {
    console.error('[NGSI Proxy] Error:', error)
    return NextResponse.json(
      { 
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, ngsild-tenant, ngsild-path, fiware-service, fiware-servicepath, link',
    },
  })
}
