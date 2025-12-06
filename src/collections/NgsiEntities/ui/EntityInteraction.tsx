'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useDocumentInfo, useFormFields, toast } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import axios from 'axios'
import './api-client.css'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD'
type EndpointStatus = 'interactive' | 'readonly' | 'disabled'

interface ApiEndpoint {
  method: HttpMethod
  path: string
  summary: string
  description: string
  status: EndpointStatus
  tag: string
  requestBody?: {
    description: string
    example: Record<string, unknown>
  }
  queryParams?: Array<{
    name: string
    description: string
    required: boolean
    example?: string
  }>
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PATCH: '#fca130',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
}

export const EntityInteraction: UIFieldClientComponent = () => {
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{
    status: number
    statusText: string
    data: unknown
    headers?: Record<string, string>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requestBody, setRequestBody] = useState<string>('')

  const { id } = useDocumentInfo()
  const entityId = useFormFields(([fields]) => fields.entityId?.value as string)
  const entityType = useFormFields(([fields]) => fields.type?.value as string)

  // Build the NGSI-LD API endpoints
  const endpoints: ApiEndpoint[] = useMemo(
    () => [
      // Entity Operations
      {
        method: 'GET',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}`,
        summary: 'Retrieve Entity',
        description:
          'Retrieve a specific Entity from the Context Broker. Returns the entity with all its attributes in normalized format.',
        status: 'interactive',
        tag: 'Entities',
        queryParams: [
          {
            name: 'options',
            description: 'Response format options',
            required: false,
            example: 'keyValues,sysAttrs',
          },
          {
            name: 'attrs',
            description: 'Comma-separated list of attribute names to include',
            required: false,
          },
        ],
      },
      {
        method: 'POST',
        path: '/ngsi-ld/v1/entities',
        summary: 'Create Entity',
        description:
          'Create a new Entity in the Context Broker. This is handled automatically when you save a new entity in Payload.',
        status: 'readonly',
        tag: 'Entities',
        requestBody: {
          description: 'Entity object to create',
          example: {
            id: entityId || 'urn:ngsi-ld:EntityType:001',
            type: entityType || 'EntityType',
            name: { type: 'Property', value: 'Example' },
          },
        },
      },
      {
        method: 'PATCH',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}/attrs`,
        summary: 'Update Entity Attributes',
        description:
          'Update one or more attributes of an existing Entity. Provide only the attributes you want to update.',
        status: 'interactive',
        tag: 'Entities',
        requestBody: {
          description: 'Attributes to update',
          example: {
            name: { type: 'Property', value: 'Updated Value' },
          },
        },
      },
      {
        method: 'DELETE',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}`,
        summary: 'Delete Entity',
        description:
          'Delete an Entity from the Context Broker. This is handled automatically when you delete the entity in Payload.',
        status: 'readonly',
        tag: 'Entities',
      },
      // Attribute Operations
      {
        method: 'POST',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}/attrs`,
        summary: 'Append Entity Attributes',
        description:
          'Append new attributes to an existing Entity. If an attribute already exists, it will not be overwritten (use PATCH instead).',
        status: 'disabled',
        tag: 'Attributes',
        requestBody: {
          description: 'Attributes to append',
          example: {
            newAttribute: { type: 'Property', value: 'New Value' },
          },
        },
      },
      {
        method: 'DELETE',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}/attrs/{attrName}`,
        summary: 'Delete Entity Attribute',
        description: 'Delete a specific attribute from an Entity.',
        status: 'disabled',
        tag: 'Attributes',
      },
      // Query Operations
      {
        method: 'GET',
        path: '/ngsi-ld/v1/entities',
        summary: 'Query Entities',
        description:
          'Query multiple entities based on type, attributes, or other filters. Useful for finding related entities.',
        status: 'disabled',
        tag: 'Query',
        queryParams: [
          { name: 'type', description: 'Entity type to filter by', required: false },
          { name: 'q', description: 'Query expression', required: false },
          { name: 'limit', description: 'Maximum number of results', required: false },
        ],
      },
      // Temporal Operations
      {
        method: 'GET',
        path: `/ngsi-ld/v1/temporal/entities/${entityId || '{entityId}'}`,
        summary: 'Retrieve Temporal Entity',
        description:
          'Retrieve historical values of entity attributes over time. Requires temporal storage to be enabled on the broker.',
        status: 'disabled',
        tag: 'Temporal',
        queryParams: [
          {
            name: 'timerel',
            description: 'Temporal relationship (before, after, between)',
            required: false,
          },
          { name: 'timeAt', description: 'Time point for the query', required: false },
        ],
      },
    ],
    [entityId, entityType],
  )

  // Group endpoints by tag
  const groupedEndpoints = useMemo(() => {
    const groups: Record<string, ApiEndpoint[]> = {}
    for (const endpoint of endpoints) {
      if (!groups[endpoint.tag]) {
        groups[endpoint.tag] = []
      }
      groups[endpoint.tag].push(endpoint)
    }
    return groups
  }, [endpoints])

  const handleExecute = useCallback(
    async (endpoint: ApiEndpoint) => {
      if (!id || endpoint.status !== 'interactive') return

      setLoading(true)
      setError(null)
      setResponse(null)

      try {
        if (
          endpoint.method === 'GET' &&
          endpoint.path.includes('/entities/') &&
          !endpoint.path.includes('/attrs')
        ) {
          // Fetch entity from broker via our API
          const { data, status, statusText } = await axios.get(`/api/ngsi-entities/${id}/fetch`)
          setResponse({ status, statusText, data })
          toast.success('Entity fetched successfully')
        } else if (endpoint.method === 'PATCH') {
          // Update entity attributes
          let parsedBody: Record<string, unknown> = {}
          if (requestBody) {
            try {
              parsedBody = JSON.parse(requestBody)
            } catch {
              throw new Error('Invalid JSON in request body')
            }
          }

          if (Object.keys(parsedBody).length === 0) {
            throw new Error('Request body cannot be empty')
          }

          const { data, status, statusText } = await axios.post(
            `/api/ngsi-entities/${id}/update-attrs`,
            {
              attributes: parsedBody,
            },
          )
          setResponse({ status, statusText, data })
          toast.success('Attributes updated successfully')
        }
      } catch (err) {
        const errorMessage = axios.isAxiosError(err)
          ? err.response?.data?.error || err.message
          : err instanceof Error
            ? err.message
            : 'Unknown error'
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [id, requestBody],
  )

  const getEndpointKey = (endpoint: ApiEndpoint) =>
    `${endpoint.method}-${endpoint.path}-${endpoint.summary}`

  if (!id) {
    return (
      <div className="api-client">
        <div className="api-client__notice">
          <div className="api-client__notice-icon">
            <InfoIcon />
          </div>
          <div>
            <strong>Save the entity first</strong>
            <p>The API client will be available after you save the entity.</p>
          </div>
        </div>
      </div>
    )
  }

  // Prevent form submission when clicking inside this component
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div className="api-client" onClick={handleContainerClick}>
      {/* Header */}
      <div className="api-client__header">
        <div className="api-client__header-info">
          <h3 className="api-client__title">NGSI-LD API</h3>
          <span className="api-client__version">v1.8</span>
        </div>
        <div className="api-client__entity-info">
          <code>{entityId}</code>
        </div>
      </div>

      {/* Sidebar + Content */}
      <div className="api-client__body">
        {/* Sidebar */}
        <div className="api-client__sidebar">
          {Object.entries(groupedEndpoints).map(([tag, tagEndpoints]) => (
            <div key={tag} className="api-client__tag-group">
              <div className="api-client__tag-title">{tag}</div>
              {tagEndpoints.map((endpoint) => {
                const key = getEndpointKey(endpoint)
                return (
                  <button
                    key={key}
                    type="button"
                    className={`api-client__endpoint-item ${activeEndpoint === key ? 'api-client__endpoint-item--active' : ''} ${endpoint.status !== 'interactive' ? 'api-client__endpoint-item--disabled' : ''}`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setActiveEndpoint(activeEndpoint === key ? null : key)
                    }}
                  >
                    <span
                      className="api-client__method-badge"
                      style={{ backgroundColor: METHOD_COLORS[endpoint.method] }}
                    >
                      {endpoint.method}
                    </span>
                    <span className="api-client__endpoint-summary">{endpoint.summary}</span>
                    {endpoint.status === 'readonly' && (
                      <span className="api-client__badge">Auto</span>
                    )}
                    {endpoint.status === 'disabled' && (
                      <span className="api-client__badge api-client__badge--muted">N/A</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="api-client__content">
          {!activeEndpoint ? (
            <div className="api-client__welcome">
              <h4>NGSI-LD Context Broker API</h4>
              <p>Select an endpoint from the sidebar to view details and interact with the API.</p>
              <div className="api-client__legend">
                <div className="api-client__legend-item">
                  <span className="api-client__legend-dot api-client__legend-dot--interactive" />
                  <span>Interactive - Execute requests</span>
                </div>
                <div className="api-client__legend-item">
                  <span className="api-client__legend-dot api-client__legend-dot--auto" />
                  <span>Auto - Handled by Payload</span>
                </div>
                <div className="api-client__legend-item">
                  <span className="api-client__legend-dot api-client__legend-dot--disabled" />
                  <span>N/A - Not available</span>
                </div>
              </div>
            </div>
          ) : (
            endpoints
              .filter((ep) => getEndpointKey(ep) === activeEndpoint)
              .map((endpoint) => (
                <div key={getEndpointKey(endpoint)} className="api-client__endpoint-detail">
                  {/* Endpoint Header */}
                  <div className="api-client__endpoint-header">
                    <span
                      className="api-client__method-badge api-client__method-badge--large"
                      style={{ backgroundColor: METHOD_COLORS[endpoint.method] }}
                    >
                      {endpoint.method}
                    </span>
                    <code className="api-client__path">{endpoint.path}</code>
                  </div>

                  <h4 className="api-client__endpoint-title">{endpoint.summary}</h4>
                  <p className="api-client__endpoint-desc">{endpoint.description}</p>

                  {/* Status Badge */}
                  {endpoint.status === 'readonly' && (
                    <div className="api-client__status-notice api-client__status-notice--info">
                      <InfoIcon />
                      <span>
                        This operation is automatically handled when you save/delete entities in
                        Payload.
                      </span>
                    </div>
                  )}

                  {endpoint.status === 'disabled' && (
                    <div className="api-client__status-notice api-client__status-notice--muted">
                      <InfoIcon />
                      <span>This operation is not available in the current implementation.</span>
                    </div>
                  )}

                  {/* Query Parameters */}
                  {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                    <div className="api-client__section">
                      <h5 className="api-client__section-title">Query Parameters</h5>
                      <div className="api-client__params">
                        {endpoint.queryParams.map((param) => (
                          <div key={param.name} className="api-client__param">
                            <div className="api-client__param-header">
                              <code className="api-client__param-name">{param.name}</code>
                              {param.required && (
                                <span className="api-client__param-required">required</span>
                              )}
                            </div>
                            <p className="api-client__param-desc">{param.description}</p>
                            {param.example && (
                              <code className="api-client__param-example">
                                Example: {param.example}
                              </code>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Request Body */}
                  {endpoint.requestBody && (
                    <div className="api-client__section">
                      <h5 className="api-client__section-title">Request Body</h5>
                      <p className="api-client__section-desc">{endpoint.requestBody.description}</p>
                      {endpoint.status === 'interactive' ? (
                        <textarea
                          className="api-client__textarea"
                          value={requestBody}
                          onChange={(e) => setRequestBody(e.target.value)}
                          placeholder={JSON.stringify(endpoint.requestBody.example, null, 2)}
                          rows={8}
                        />
                      ) : (
                        <pre className="api-client__code-block">
                          {JSON.stringify(endpoint.requestBody.example, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Execute Button */}
                  {endpoint.status === 'interactive' && (
                    <div className="api-client__actions">
                      <button
                        type="button"
                        className="api-client__execute-btn"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleExecute(endpoint)
                        }}
                        disabled={loading}
                      >
                        {loading ? 'Executing...' : 'Execute'}
                      </button>
                    </div>
                  )}

                  {/* Response */}
                  {(response || error) && (
                    <div className="api-client__section">
                      <h5 className="api-client__section-title">Response</h5>
                      {error ? (
                        <div className="api-client__response api-client__response--error">
                          <div className="api-client__response-header">
                            <span className="api-client__response-status api-client__response-status--error">
                              Error
                            </span>
                          </div>
                          <pre className="api-client__response-body">{error}</pre>
                        </div>
                      ) : response ? (
                        <div className="api-client__response api-client__response--success">
                          <div className="api-client__response-header">
                            <span
                              className={`api-client__response-status ${response.status >= 200 && response.status < 300 ? 'api-client__response-status--success' : 'api-client__response-status--error'}`}
                            >
                              {response.status} {response.statusText}
                            </span>
                          </div>
                          <pre className="api-client__response-body">
                            {typeof response.data === 'string'
                              ? response.data
                              : JSON.stringify(response.data, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  )
}

// Simple info icon component
const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)
