'use client'

import React, { useCallback, useState } from 'react'
import { toast, useFormFields, useDocumentInfo, Button } from '@payloadcms/ui'
import type { FieldClientComponent } from 'payload'
import axios from 'axios'
import { RefreshCw, Download, Check, AlertCircle } from 'lucide-react'

interface DiscoveredEntity {
  id: string
  type: string
  service: string
  servicePath: string
  alreadySynced: boolean
}

interface DiscoverResponse {
  entities: DiscoveredEntity[]
  total: number
  alreadySynced: number
  errors?: string[]
}

export const SyncEntities: FieldClientComponent = () => {
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [entities, setEntities] = useState<DiscoveredEntity[]>([])
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set())
  const [discovered, setDiscovered] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const { id: sourceId } = useDocumentInfo()
  const brokerUrl = useFormFields(([fields]) => fields.brokerUrl?.value as string)

  const handleDiscover = useCallback(async () => {
    if (!sourceId) {
      toast.error('Please save the source first')
      return
    }

    setLoading(true)
    setErrors([])

    try {
      const { data } = await axios.post<DiscoverResponse>('/api/ngsi-sources/discover-entities', {
        sourceId,
      })

      setEntities(data.entities)
      setDiscovered(true)

      if (data.errors?.length) {
        setErrors(data.errors)
      }

      const newEntitiesCount = data.total - data.alreadySynced
      toast.success(
        `Found ${data.total} entities (${newEntitiesCount} new, ${data.alreadySynced} already synced)`,
      )
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : 'Unknown error'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [sourceId])

  const handleSelectAll = useCallback(() => {
    const newEntities = entities.filter((e) => !e.alreadySynced)
    if (selectedEntities.size === newEntities.length) {
      setSelectedEntities(new Set())
    } else {
      setSelectedEntities(new Set(newEntities.map((e) => e.id)))
    }
  }, [entities, selectedEntities])

  const handleToggleEntity = useCallback((entityId: string) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev)
      if (next.has(entityId)) {
        next.delete(entityId)
      } else {
        next.add(entityId)
      }
      return next
    })
  }, [])

  const handleImport = useCallback(async () => {
    if (selectedEntities.size === 0) {
      toast.error('Please select entities to import')
      return
    }

    setImporting(true)

    try {
      // Fetch full details for selected entities
      const entitiesToImport = []

      for (const entityId of selectedEntities) {
        const entity = entities.find((e) => e.id === entityId)
        if (!entity) continue

        try {
          const { data } = await axios.post('/api/ngsi-sources/fetch-entity-details', {
            sourceId,
            entityId: entity.id,
            service: entity.service,
            servicePath: entity.servicePath,
          })

          entitiesToImport.push({
            entityId: entity.id,
            type: entity.type,
            service: entity.service,
            servicePath: entity.servicePath,
            attributes: data.attributes,
          })
        } catch (error) {
          console.error(`Failed to fetch details for ${entityId}:`, error)
        }
      }

      if (entitiesToImport.length === 0) {
        toast.error('Failed to fetch entity details')
        return
      }

      const { data } = await axios.post('/api/ngsi-sources/import-entities', {
        sourceId,
        entities: entitiesToImport,
      })

      toast.success(data.message)

      // Update entities list to mark imported ones as synced
      setEntities((prev) =>
        prev.map((e) => (data.success.includes(e.id) ? { ...e, alreadySynced: true } : e)),
      )
      setSelectedEntities(new Set())

      if (data.failed?.length > 0) {
        const failedMsg = data.failed
          .map((f: { id: string; error: string }) => `${f.id}: ${f.error}`)
          .join(', ')
        toast.error(`Some imports failed: ${failedMsg}`)
      }
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : 'Unknown error'
      toast.error(errorMessage)
    } finally {
      setImporting(false)
    }
  }, [sourceId, selectedEntities, entities])

  const newEntities = entities.filter((e) => !e.alreadySynced)
  const syncedEntities = entities.filter((e) => e.alreadySynced)

  return (
    <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <Button
          onClick={handleDiscover}
          disabled={loading || !brokerUrl || !sourceId}
          buttonStyle="secondary"
        >
          <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
          {loading ? 'Discovering...' : 'Discover Entities'}
        </Button>

        {discovered && newEntities.length > 0 && (
          <Button
            onClick={handleImport}
            disabled={importing || selectedEntities.size === 0}
            buttonStyle="primary"
          >
            <Download size={16} style={{ marginRight: '0.5rem' }} />
            {importing ? 'Importing...' : `Import Selected (${selectedEntities.size})`}
          </Button>
        )}
      </div>

      {!sourceId && (
        <p style={{ fontSize: '0.875rem', color: '#666' }}>
          Save the source first to discover entities from the broker.
        </p>
      )}

      {errors.length > 0 && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            padding: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}
          >
            <AlertCircle size={16} color="#dc2626" />
            <strong style={{ color: '#dc2626' }}>Some tenants had errors:</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#7f1d1d' }}>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {discovered && entities.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
          {newEntities.length > 0 && (
            <>
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 500 }}>New Entities ({newEntities.length})</span>
                <Button onClick={handleSelectAll} buttonStyle="secondary" size="small">
                  {selectedEntities.size === newEntities.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th
                        style={{
                          padding: '0.5rem',
                          textAlign: 'left',
                          borderBottom: '1px solid #e5e7eb',
                          width: '40px',
                        }}
                      ></th>
                      <th
                        style={{
                          padding: '0.5rem',
                          textAlign: 'left',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        Entity ID
                      </th>
                      <th
                        style={{
                          padding: '0.5rem',
                          textAlign: 'left',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        Type
                      </th>
                      <th
                        style={{
                          padding: '0.5rem',
                          textAlign: 'left',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        Service
                      </th>
                      <th
                        style={{
                          padding: '0.5rem',
                          textAlign: 'left',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        Path
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {newEntities.map((entity) => (
                      <tr
                        key={entity.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleEntity(entity.id)}
                      >
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                          <input
                            type="checkbox"
                            checked={selectedEntities.has(entity.id)}
                            onChange={() => handleToggleEntity(entity.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                          }}
                        >
                          {entity.id}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                            }}
                          >
                            {entity.type}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                          }}
                        >
                          {entity.service || '(default)'}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                          }}
                        >
                          {entity.servicePath}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {syncedEntities.length > 0 && (
            <>
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#f0fdf4',
                  borderBottom: '1px solid #e5e7eb',
                  borderTop: newEntities.length > 0 ? '1px solid #e5e7eb' : 'none',
                }}
              >
                <span style={{ fontWeight: 500, color: '#166534' }}>
                  <Check size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Already Synced ({syncedEntities.length})
                </span>
              </div>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {syncedEntities.map((entity) => (
                      <tr key={entity.id} style={{ opacity: 0.6 }}>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            width: '40px',
                          }}
                        >
                          <Check size={16} color="#16a34a" />
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                          }}
                        >
                          {entity.id}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: '#dcfce7',
                              color: '#166534',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                            }}
                          >
                            {entity.type}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                          }}
                        >
                          {entity.service || '(default)'}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                          }}
                        >
                          {entity.servicePath}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {discovered && entities.length === 0 && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fefce8',
            border: '1px solid #fef08a',
            borderRadius: '4px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, color: '#854d0e' }}>
            No entities found in the broker. Make sure the broker has entities and the tenant
            configuration is correct.
          </p>
        </div>
      )}
    </div>
  )
}
