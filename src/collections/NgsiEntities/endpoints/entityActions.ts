import type { PayloadHandler } from 'payload'
import { NgsiLdOperations, NGSI_LD_CORE_CONTEXT } from '@/lib/ngsi-ld'
import axios from 'axios'

export const fetchEntityEndpoint: PayloadHandler = async (req) => {
  const id = req.routeParams?.id as string

  if (!id) {
    return Response.json({ error: 'Entity ID is required' }, { status: 400 })
  }

  try {
    const entity = await req.payload.findByID({
      collection: 'ngsi-entities',
      id,
      depth: 2,
    })

    if (!entity) {
      return Response.json({ error: 'Entity not found in Payload' }, { status: 404 })
    }

    const source = entity.source as any
    const dataModel = entity.dataModel as any

    if (!source?.brokerUrl) {
      return Response.json({ error: 'Source broker URL not configured' }, { status: 400 })
    }

    if (!entity.entityId) {
      return Response.json({ error: 'Entity ID (URN) not set' }, { status: 400 })
    }

    const contextUrl = dataModel?.contextUrl || NGSI_LD_CORE_CONTEXT

    // Create NGSI-LD operations client
    const ngsi = new NgsiLdOperations(
      {
        brokerUrl: source.brokerUrl,
        service: entity.service || undefined,
        servicePath: entity.servicePath,
        authToken: source.authToken,
      },
      contextUrl,
    )

    // GET entity with compacted response (using Link header)
    const data = await ngsi.getEntity(entity.entityId)

    return Response.json(data)
  } catch (error) {
    let errorMessage = 'Unknown error'
    let statusCode = 500

    if (axios.isAxiosError(error)) {
      statusCode = error.response?.status || 500
      errorMessage = error.response?.data?.detail || error.response?.data?.title || error.message

      // If entity not found in broker
      if (statusCode === 404) {
        errorMessage = 'Entity not found in Context Broker. Try "Force Resync" to create it.'
      }
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    return Response.json({ error: errorMessage }, { status: statusCode })
  }
}

export const resyncEntityEndpoint: PayloadHandler = async (req) => {
  const id = req.routeParams?.id as string

  if (!id) {
    return Response.json({ error: 'Entity ID is required' }, { status: 400 })
  }

  try {
    const entity = await req.payload.findByID({
      collection: 'ngsi-entities',
      id,
      depth: 2,
    })

    if (!entity) {
      return Response.json({ error: 'Entity not found' }, { status: 404 })
    }

    const source = entity.source as any
    const dataModel = entity.dataModel as any

    if (!source?.brokerUrl) {
      return Response.json({ error: 'Source broker URL not configured' }, { status: 400 })
    }

    const contextUrl = dataModel?.contextUrl || NGSI_LD_CORE_CONTEXT

    // Create NGSI-LD operations client
    const ngsi = new NgsiLdOperations(
      {
        brokerUrl: source.brokerUrl,
        service: entity.service,
        servicePath: entity.servicePath,
        authToken: source.authToken,
      },
      contextUrl,
    )

    // Extract short type name (without URL prefix) for proper NGSI-LD format
    let entityType = entity.type || dataModel?.model
    if (entityType && entityType.includes('/')) {
      entityType = entityType.split('/').pop() || entityType
    }

    // Build entity body
    const entityBody = {
      id: entity.entityId,
      type: entityType,
      ...entity.attributes,
    }

    // Upsert - create if not exists, update if exists
    await ngsi.upsertEntity(entityBody)

    // Update sync status
    await req.payload.update({
      collection: 'ngsi-entities',
      id,
      data: {
        syncStatus: 'synced',
        lastSyncTime: new Date().toISOString(),
        lastSyncError: null,
      },
      context: {
        skipSync: true,
      },
    })

    return Response.json({ message: 'Entity resynced successfully' })
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'response' in error
          ? JSON.stringify((error as any).response?.data || error)
          : 'Unknown error'

    // Update sync status to error
    await req.payload.update({
      collection: 'ngsi-entities',
      id,
      data: {
        syncStatus: 'error',
        lastSyncTime: new Date().toISOString(),
        lastSyncError: errorMessage,
      },
      context: {
        skipSync: true,
      },
    })

    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
