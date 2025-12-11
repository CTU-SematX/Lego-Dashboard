'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  NgsiBrowserClient,
  NgsiEntity,
  NgsiError,
  NgsiBrowserClientConfig,
} from '@/lib/ngsi-ld/browser-client'

export interface UseNgsiDataOptions {
  brokerUrl: string
  sourceId?: string // Source ID for server-side API fetching (recommended for HTTPS sites)
  proxyUrl?: string // Deprecated: Optional HTTPS proxy URL to avoid mixed content errors
  entityId?: string // Single entity mode
  entityIds?: string[] // Multiple specific entity IDs to filter
  entityType?: string // Query mode (multiple entities)
  tenant?: string
  servicePath?: string
  contextUrl?: string
  attrs?: string[] // Filter attributes
  refreshInterval?: number // Seconds, 0 = disabled
  enabled?: boolean // Conditional fetching
}

export interface UseNgsiDataResult<T> {
  data: T | null
  isLoading: boolean
  error: NgsiError | null
  refetch: () => Promise<void>
  lastUpdated: Date | null
}

/**
 * React hook for fetching NGSI-LD entity data from browser.
 *
 * Supports:
 * - Single entity fetch (entityId)
 * - Multiple entities query (entityType)
 * - Auto-refresh with configurable interval
 * - Error handling with retry
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useNgsiData({
 *   brokerUrl: 'http://localhost:1026',
 *   entityId: 'urn:ngsi-ld:WeatherObserved:006',
 *   tenant: 'Cantho',
 *   refreshInterval: 30, // refresh every 30s
 * })
 * ```
 */
export function useNgsiData<T = NgsiEntity | NgsiEntity[]>(
  options: UseNgsiDataOptions,
): UseNgsiDataResult<T> {
  const {
    brokerUrl,
    sourceId,
    proxyUrl,
    entityId,
    entityIds,
    entityType,
    tenant,
    servicePath,
    contextUrl,
    attrs,
    refreshInterval = 0,
    enabled = true,
  } = options

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<NgsiError | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Create client config (stable reference for comparison)
  const clientConfig: NgsiBrowserClientConfig = {
    brokerUrl,
    sourceId,
    proxyUrl,
    tenant,
    servicePath,
    contextUrl,
  }

  const fetchData = useCallback(async () => {
    if (!enabled || !brokerUrl) {
      return
    }

    // Must have either entityId or entityType
    if (!entityId && !entityType) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const client = new NgsiBrowserClient(clientConfig)

      let result: T

      if (entityId) {
        // Single entity mode
        result = (await client.getEntity(entityId, { attrs })) as T
      } else if (entityType) {
        // Query mode - pass entityIds for filtering if provided
        result = (await client.queryEntities({ type: entityType, ids: entityIds, attrs })) as T
      } else {
        throw new NgsiError('Either entityId or entityType is required', 400)
      }

      if (isMountedRef.current) {
        setData(result)
        setLastUpdated(new Date())
        setError(null)
      }
    } catch (err) {
      if (isMountedRef.current) {
        if (err instanceof NgsiError) {
          setError(err)
        } else if (err instanceof Error) {
          setError(new NgsiError(err.message, 0))
        } else {
          setError(new NgsiError('Unknown error occurred', 0))
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [brokerUrl, sourceId, proxyUrl, entityId, entityIds?.join(','), entityType, tenant, servicePath, contextUrl, attrs?.join(','), enabled])

  // Initial fetch and dependency change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh interval
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Set up new interval if enabled and > 0
    if (refreshInterval > 0 && enabled) {
      intervalRef.current = setInterval(() => {
        fetchData()
      }, refreshInterval * 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [refreshInterval, enabled, fetchData])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  return {
    data,
    isLoading,
    error,
    refetch,
    lastUpdated,
  }
}

export type { NgsiEntity, NgsiError }
