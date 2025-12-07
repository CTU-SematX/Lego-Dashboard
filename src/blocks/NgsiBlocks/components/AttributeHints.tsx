'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Copy, Check, Loader2, Info } from 'lucide-react'
import { extractAttributePaths } from '../lib/templateParser'
import { extractAttributeValue, getEntityAttributeNames } from '../lib/attributeHelpers'
import type { NgsiEntity } from '@/lib/ngsi-ld/browser-client'

interface AttributeHintsProps {
  /** Entity data to extract attributes from */
  entity: NgsiEntity | null
  /** Whether data is loading */
  isLoading?: boolean
  /** Optional className */
  className?: string
}

/**
 * Display available attribute paths that can be used in templates
 * Shows copyable chips for each {{data.xxx}} path
 */
export function AttributeHints({ entity, isLoading, className }: AttributeHintsProps) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const [paths, setPaths] = useState<string[]>([])

  // Extract paths when entity changes
  useEffect(() => {
    if (!entity) {
      setPaths([])
      return
    }

    // First extract values from NGSI format
    const processedData: Record<string, unknown> = {}
    const attrNames = getEntityAttributeNames(entity)

    for (const name of attrNames) {
      processedData[name] = extractAttributeValue(entity[name])
    }

    // Then get all nested paths
    const extractedPaths = extractAttributePaths(processedData)
    setPaths(extractedPaths)
  }, [entity])

  const handleCopy = useCallback(async (path: string) => {
    const template = `{{${path}}}`
    try {
      await navigator.clipboard.writeText(template)
      setCopiedPath(path)
      setTimeout(() => setCopiedPath(null), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      console.warn('Clipboard API not available')
    }
  }, [])

  if (isLoading) {
    return (
      <div
        className={`rounded-md border border-border bg-muted/30 p-3 ${className || ''}`}
        role="status"
        aria-label="Loading attributes"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading available attributes...</span>
        </div>
      </div>
    )
  }

  if (!entity || paths.length === 0) {
    return (
      <div
        className={`rounded-md border border-border bg-muted/30 p-3 ${className || ''}`}
        role="note"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Select an entity to see available attributes</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-md border border-border bg-muted/30 p-3 ${className || ''}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Info className="h-3 w-3" />
        <span>Available placeholders (click to copy):</span>
      </div>

      {/* System placeholders */}
      <div className="mb-2 flex flex-wrap gap-1">
        <AttributeChip
          path="entityId"
          isCopied={copiedPath === 'entityId'}
          onCopy={() => handleCopy('entityId')}
          variant="system"
        />
        <AttributeChip
          path="entityType"
          isCopied={copiedPath === 'entityType'}
          onCopy={() => handleCopy('entityType')}
          variant="system"
        />
      </div>

      {/* Data placeholders */}
      <div className="flex flex-wrap gap-1">
        {paths.map((path) => (
          <AttributeChip
            key={path}
            path={path}
            isCopied={copiedPath === path}
            onCopy={() => handleCopy(path)}
          />
        ))}
      </div>
    </div>
  )
}

interface AttributeChipProps {
  path: string
  isCopied: boolean
  onCopy: () => void
  variant?: 'default' | 'system'
}

function AttributeChip({ path, isCopied, onCopy, variant = 'default' }: AttributeChipProps) {
  const baseClasses =
    'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono cursor-pointer transition-colors'
  const variantClasses =
    variant === 'system'
      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`${baseClasses} ${variantClasses}`}
      title={`Copy {{${path}}}`}
      aria-label={`Copy placeholder {{${path}}}`}
    >
      <span>{`{{${path}}}`}</span>
      {isCopied ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3 opacity-50" />
      )}
    </button>
  )
}

export default AttributeHints
