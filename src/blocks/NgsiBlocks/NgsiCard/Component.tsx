'use client'

import { useNgsiData, NgsiEntity as NgsiEntityData } from '../hooks/useNgsiData'
import {
  filterAttributes,
  formatAttributeName,
  getAttributeMetadata,
} from '../lib/attributeHelpers'
import type { AttributeSelectionMode } from '../fields/ngsiDataSource'
import type { NgsiCardBlock as NgsiCardBlockType } from '@/payload-types'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { cn } from '@/utilities/ui'
import { RefreshCw, AlertCircle, Clock, ExternalLink } from 'lucide-react'

export interface NgsiCardBlockProps extends NgsiCardBlockType {
  className?: string
}

/**
 * NgsiCard Block Component
 *
 * Displays a single NGSI-LD entity in a card format.
 * Data is fetched directly from the Context Broker via browser.
 */
export function NgsiCardBlock({
  dataSource,
  displayOptions,
  className,
}: NgsiCardBlockProps) {
  // Extract configuration from populated relationships
  const source = typeof dataSource.source === 'object' ? dataSource.source : null
  const entity = typeof dataSource.entity === 'object' ? dataSource.entity : null
  const dataModel = entity && typeof entity.dataModel === 'object' ? entity.dataModel : null

  // Build configuration for the hook
  const brokerUrl = source?.proxyUrl || source?.brokerUrl || ''
  const entityId = entity?.entityId || ''
  const contextUrl = dataModel?.contextUrl

  // Get selected attributes list
  const selectedAttrs = dataSource.selectedAttributes?.map((a) => a.attribute) || []

  // Fetch entity data
  const { data, isLoading, error, refetch, lastUpdated } = useNgsiData<NgsiEntityData>({
    brokerUrl,
    entityId,
    tenant: dataSource.tenant || undefined,
    servicePath: dataSource.servicePath || undefined,
    contextUrl,
    refreshInterval: dataSource.refreshInterval || 0,
    enabled: Boolean(brokerUrl && entityId),
  })

  // Filter attributes based on selection mode
  const attributeMode = dataSource.attributeSelection || 'all'
  const filteredAttributes = data
    ? filterAttributes(data, attributeMode as AttributeSelectionMode, selectedAttrs)
    : {}

  // Card style classes
  const cardStyle = displayOptions?.cardStyle || 'default'
  const cardClasses = cn(
    'transition-shadow hover:shadow-md',
    {
      'p-2': cardStyle === 'compact',
      'p-4': cardStyle === 'default',
      'p-6': cardStyle === 'detailed',
    },
    className,
  )

  // Build title with placeholders
  const buildTitle = () => {
    let title = displayOptions?.title || 'NGSI Entity'
    if (data) {
      title = title
        .replace(/\{\{entityId\}\}/g, data.id)
        .replace(/\{\{entityType\}\}/g, data.type)
    }
    return title
  }

  // Error state
  if (error) {
    return (
      <Card className={cn(cardClasses, 'border-destructive')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Entity
          </CardTitle>
          <CardDescription>{entityId}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error.message}
            {error.detail && <span className="block mt-1">{error.detail}</span>}
          </p>
        </CardContent>
        <CardFooter>
          <button
            onClick={() => refetch()}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </CardFooter>
      </Card>
    )
  }

  // Loading state
  if (isLoading && !data) {
    return (
      <Card className={cardClasses}>
        <CardHeader>
          <CardTitle className="animate-pulse bg-muted h-6 w-48 rounded" />
          <CardDescription className="animate-pulse bg-muted h-4 w-32 rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-muted h-4 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // No data state
  if (!data) {
    return (
      <Card className={cardClasses}>
        <CardHeader>
          <CardTitle>No Data</CardTitle>
          <CardDescription>{entityId || 'Entity not configured'}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={cardClasses}>
      <CardHeader className={cardStyle === 'compact' ? 'pb-2' : undefined}>
        <CardTitle className="flex items-center justify-between">
          <span>{buildTitle()}</span>
          {isLoading && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </CardTitle>
        {displayOptions?.showEntityId && (
          <CardDescription className="flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            {data.id}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className={cardStyle === 'compact' ? 'pt-0' : undefined}>
        <dl className={cn('space-y-2', {
          'text-sm': cardStyle === 'compact',
          'text-base': cardStyle === 'detailed',
        })}>
          {Object.entries(filteredAttributes).map(([key, value]) => {
            const metadata = getAttributeMetadata(data[key])

            return (
              <div
                key={key}
                className={cn('flex justify-between', {
                  'flex-col gap-1': cardStyle === 'detailed',
                  'items-center': cardStyle !== 'detailed',
                })}
              >
                <dt className="font-medium text-muted-foreground">
                  {formatAttributeName(key)}
                  {metadata?.unitCode && (
                    <span className="ml-1 text-xs">({metadata.unitCode})</span>
                  )}
                </dt>
                <dd className="font-semibold">
                  {formatValue(value)}
                </dd>
              </div>
            )
          })}
        </dl>
      </CardContent>

      {displayOptions?.showLastUpdated && lastUpdated && (
        <CardFooter className="text-xs text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Last updated: {lastUpdated.toLocaleTimeString()}
        </CardFooter>
      )}
    </Card>
  )
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (typeof value === 'number') {
    // Format numbers with reasonable precision
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }

  if (typeof value === 'object') {
    // For geo coordinates or complex objects
    return JSON.stringify(value)
  }

  return String(value)
}

export default NgsiCardBlock
