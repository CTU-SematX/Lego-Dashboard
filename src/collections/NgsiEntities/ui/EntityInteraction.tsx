'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useDocumentInfo, useFormFields, toast } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import axios from 'axios'
import './api-client.css'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD'

interface ApiEndpoint {
  id: string
  method: HttpMethod
  path: string
  summary: string
  description: string
  tag: string
  pathParams?: Array<{
    name: string
    description: string
    required: boolean
    placeholder?: string
  }>
  queryParams?: Array<{
    name: string
    description: string
    required: boolean
    type: string
    example?: string
  }>
  requestBody?: {
    description: string
    contentType: string
    example: Record<string, unknown>
  }
  responses: Array<{
    status: number
    description: string
  }>
}

interface Header {
  key: string
  value: string
  enabled: boolean
}

interface QueryParam {
  key: string
  value: string
  enabled: boolean
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
  const [requestBody, setRequestBody] = useState<string>('')
  const [headers, setHeaders] = useState<Header[]>([
    { key: 'Accept', value: 'application/json', enabled: true },
  ])
  const [queryParams, setQueryParams] = useState<QueryParam[]>([])

  const { id } = useDocumentInfo()
  const entityId = useFormFields(([fields]) => fields.entityId?.value as string)
  const entityType = useFormFields(([fields]) => fields.type?.value as string)

  // Build the NGSI-LD API endpoints following spec
  const endpoints: ApiEndpoint[] = useMemo(
    () => [
      // Entity CRUD Operations
      {
        id: 'get-entity',
        method: 'GET',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}`,
        summary: 'Retrieve Entity',
        description: 'Retrieve a specific Entity from the Context Broker by its identifier.',
        tag: 'Entities',
        queryParams: [
          {
            name: 'attrs',
            description: 'Comma-separated list of attribute names to retrieve',
            required: false,
            type: 'string',
            example: 'temperature,humidity',
          },
          {
            name: 'options',
            description: 'Retrieval options: keyValues, sysAttrs',
            required: false,
            type: 'string',
            example: 'keyValues',
          },
        ],
        responses: [
          { status: 200, description: 'Entity retrieved successfully' },
          { status: 404, description: 'Entity not found' },
        ],
      },
      {
        id: 'create-entity',
        method: 'POST',
        path: '/ngsi-ld/v1/entities',
        summary: 'Create Entity',
        description: 'Create a new Entity in the Context Broker.',
        tag: 'Entities',
        requestBody: {
          description: 'Entity to create in NGSI-LD format',
          contentType: 'application/json',
          example: {
            id: entityId || 'urn:ngsi-ld:EntityType:001',
            type: entityType || 'EntityType',
            name: { type: 'Property', value: 'Example Name' },
          },
        },
        responses: [
          { status: 201, description: 'Entity created successfully' },
          { status: 409, description: 'Entity already exists' },
        ],
      },
      {
        id: 'delete-entity',
        method: 'DELETE',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}`,
        summary: 'Delete Entity',
        description: 'Delete an Entity from the Context Broker.',
        tag: 'Entities',
        responses: [
          { status: 204, description: 'Entity deleted successfully' },
          { status: 404, description: 'Entity not found' },
        ],
      },
      {
        id: 'head-entity',
        method: 'HEAD',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}`,
        summary: 'Check Entity Exists',
        description: 'Check if an Entity exists without retrieving its content.',
        tag: 'Entities',
        responses: [
          { status: 200, description: 'Entity exists' },
          { status: 404, description: 'Entity not found' },
        ],
      },
      // Attribute Operations
      {
        id: 'update-attrs',
        method: 'PATCH',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}/attrs`,
        summary: 'Update Entity Attributes',
        description: 'Update existing attributes of an Entity. Only provided attributes are updated.',
        tag: 'Attributes',
        requestBody: {
          description: 'Attributes to update in NGSI-LD format',
          contentType: 'application/json',
          example: {
            name: { type: 'Property', value: 'Updated Name' },
          },
        },
        responses: [
          { status: 204, description: 'Attributes updated successfully' },
          { status: 404, description: 'Entity not found' },
          { status: 207, description: 'Partial success (multi-status)' },
        ],
      },
      {
        id: 'append-attrs',
        method: 'POST',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}/attrs`,
        summary: 'Append Entity Attributes',
        description: 'Append new attributes to an Entity. Use options=noOverwrite to prevent updating existing attributes.',
        tag: 'Attributes',
        queryParams: [
          {
            name: 'options',
            description: 'Use "noOverwrite" to not overwrite existing attributes',
            required: false,
            type: 'string',
            example: 'noOverwrite',
          },
        ],
        requestBody: {
          description: 'Attributes to append in NGSI-LD format',
          contentType: 'application/json',
          example: {
            newAttribute: { type: 'Property', value: 'New Value' },
          },
        },
        responses: [
          { status: 204, description: 'Attributes appended successfully' },
          { status: 404, description: 'Entity not found' },
          { status: 207, description: 'Partial success (multi-status)' },
        ],
      },
      {
        id: 'delete-attr',
        method: 'DELETE',
        path: `/ngsi-ld/v1/entities/${entityId || '{entityId}'}/attrs/{attrName}`,
        summary: 'Delete Entity Attribute',
        description: 'Delete a specific attribute from an Entity.',
        tag: 'Attributes',
        pathParams: [
          {
            name: 'attrName',
            description: 'Name of the attribute to delete',
            required: true,
            placeholder: 'attributeName',
          },
        ],
        responses: [
          { status: 204, description: 'Attribute deleted successfully' },
          { status: 404, description: 'Entity or attribute not found' },
        ],
      },
      // Query Operations
      {
        id: 'query-entities',
        method: 'GET',
        path: '/ngsi-ld/v1/entities',
        summary: 'Query Entities',
        description: 'Query entities by type, attributes, or complex expressions.',
        tag: 'Query',
        queryParams: [
          {
            name: 'type',
            description: 'Entity type to filter',
            required: false,
            type: 'string',
            example: entityType || 'Building',
          },
          {
            name: 'q',
            description: 'Query expression (e.g., temperature>25)',
            required: false,
            type: 'string',
          },
          {
            name: 'attrs',
            description: 'Attributes to retrieve',
            required: false,
            type: 'string',
          },
          {
            name: 'limit',
            description: 'Maximum number of results',
            required: false,
            type: 'integer',
            example: '20',
          },
          {
            name: 'offset',
            description: 'Pagination offset',
            required: false,
            type: 'integer',
            example: '0',
          },
          {
            name: 'options',
            description: 'Response options: keyValues, count',
            required: false,
            type: 'string',
          },
        ],
        responses: [
          { status: 200, description: 'Entities retrieved successfully' },
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

  // Get current endpoint
  const currentEndpoint = useMemo(
    () => endpoints.find((ep) => ep.id === activeEndpoint),
    [endpoints, activeEndpoint],
  )

  // Update request body when endpoint changes
  useEffect(() => {
    if (currentEndpoint?.requestBody) {
      setRequestBody(JSON.stringify(currentEndpoint.requestBody.example, null, 2))
    } else {
      setRequestBody('')
    }
    setResponse(null)
    
    // Reset query params based on endpoint
    if (currentEndpoint?.queryParams) {
      setQueryParams(
        currentEndpoint.queryParams.map((p) => ({
          key: p.name,
          value: p.example || '',
          enabled: false,
        })),
      )
    } else {
      setQueryParams([])
    }
  }, [currentEndpoint])

  const handleAddHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { key: '', value: '', enabled: true }])
  }, [])

  const handleRemoveHeader = useCallback((index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleHeaderChange = useCallback((index: number, field: 'key' | 'value' | 'enabled', newValue: string | boolean) => {
    setHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: newValue } : h)),
    )
  }, [])

  const handleQueryParamChange = useCallback((index: number, field: 'key' | 'value' | 'enabled', newValue: string | boolean) => {
    setQueryParams((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: newValue } : p)),
    )
  }, [])

  const handleExecute = useCallback(async () => {
    if (!id || !currentEndpoint) return

    setLoading(true)
    setResponse(null)

    try {
      // Build query params
      const enabledParams: Record<string, string> = {}
      queryParams.filter((p) => p.enabled && p.key && p.value).forEach((p) => {
        enabledParams[p.key] = p.value
      })

      // Build headers
      const enabledHeaders: Record<string, string> = {}
      headers.filter((h) => h.enabled && h.key && h.value).forEach((h) => {
        enabledHeaders[h.key] = h.value
      })

      // Parse request body if needed
      let parsedBody: unknown = undefined
      if (requestBody && ['POST', 'PATCH'].includes(currentEndpoint.method)) {
        try {
          parsedBody = JSON.parse(requestBody)
        } catch {
          toast.error('Invalid JSON in request body')
          setLoading(false)
          return
        }
      }

      // Call our broker API endpoint
      const { data } = await axios.post(`/api/ngsi-entities/${id}/broker`, {
        method: currentEndpoint.method,
        path: currentEndpoint.path,
        requestBody: parsedBody,
        headers: enabledHeaders,
        queryParams: enabledParams,
      })

      setResponse({
        status: data.status,
        statusText: data.statusText,
        data: data.data,
        headers: data.headers,
      })

      if (data.status >= 200 && data.status < 300) {
        toast.success('Request successful')
      }
    } catch (err) {
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error'
      
      setResponse({
        status: 500,
        statusText: 'Error',
        data: { error: errorMessage },
      })
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [id, currentEndpoint, requestBody, headers, queryParams])

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  if (!id) {
    return (
      <div className="api-client">
        <div className="api-client__notice">
          <InfoIcon />
          <div>
            <strong>Save the entity first</strong>
            <p>The API client will be available after you save the entity.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="api-client" onClick={handleContainerClick}>
      {/* Header */}
      <div className="api-client__header">
        <div className="api-client__header-info">
          <h3 className="api-client__title">NGSI-LD API Client</h3>
          <span className="api-client__version">v1.8</span>
        </div>
        <div className="api-client__entity-info">
          <code>{entityId}</code>
        </div>
      </div>

      {/* Body */}
      <div className="api-client__body">
        {/* Sidebar */}
        <nav className="api-client__sidebar">
          {Object.entries(groupedEndpoints).map(([tag, tagEndpoints]) => (
            <div key={tag} className="api-client__tag-group">
              <div className="api-client__tag-title">{tag}</div>
              {tagEndpoints.map((endpoint) => (
                <button
                  key={endpoint.id}
                  type="button"
                  className={`api-client__endpoint-item ${activeEndpoint === endpoint.id ? 'api-client__endpoint-item--active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setActiveEndpoint(activeEndpoint === endpoint.id ? null : endpoint.id)
                  }}
                >
                  <span
                    className="api-client__method-badge"
                    style={{ backgroundColor: METHOD_COLORS[endpoint.method] }}
                  >
                    {endpoint.method}
                  </span>
                  <span className="api-client__endpoint-summary">{endpoint.summary}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Main Content */}
        <div className="api-client__content">
          {!currentEndpoint ? (
            <div className="api-client__welcome">
              <h4>NGSI-LD Context Broker API</h4>
              <p>Select an endpoint from the sidebar to view details and execute requests.</p>
              <div className="api-client__spec-link">
                <a
                  href="https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_CIM009v010801p.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View NGSI-LD Specification (ETSI GS CIM 009 V1.8.1)
                </a>
              </div>
            </div>
          ) : (
            <div className="api-client__endpoint-view">
              {/* Request Panel */}
              <div className="api-client__panel">
                <div className="api-client__panel-header">
                  <span
                    className="api-client__method-badge api-client__method-badge--large"
                    style={{ backgroundColor: METHOD_COLORS[currentEndpoint.method] }}
                  >
                    {currentEndpoint.method}
                  </span>
                  <code className="api-client__path">{currentEndpoint.path}</code>
                  <button
                    type="button"
                    className="api-client__send-btn"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleExecute()
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <LoadingIcon /> Sending...
                      </>
                    ) : (
                      <>
                        <SendIcon /> Send
                      </>
                    )}
                  </button>
                </div>

                <h4 className="api-client__endpoint-title">{currentEndpoint.summary}</h4>
                <p className="api-client__endpoint-desc">{currentEndpoint.description}</p>

                {/* Headers */}
                <div className="api-client__section">
                  <div className="api-client__section-header">
                    <h5 className="api-client__section-title">Headers</h5>
                    <button
                      type="button"
                      className="api-client__add-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAddHeader()
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  <table className="api-client__table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Key</th>
                        <th>Value</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {headers.map((header, idx) => (
                        <tr key={idx} className={header.enabled ? '' : 'api-client__row--disabled'}>
                          <td>
                            <input
                              type="checkbox"
                              checked={header.enabled}
                              onChange={(e) => handleHeaderChange(idx, 'enabled', e.target.checked)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={header.key}
                              onChange={(e) => handleHeaderChange(idx, 'key', e.target.value)}
                              placeholder="Header name"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => handleHeaderChange(idx, 'value', e.target.value)}
                              placeholder="Value"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="api-client__remove-btn"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleRemoveHeader(idx)
                              }}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Query Parameters */}
                {currentEndpoint.queryParams && currentEndpoint.queryParams.length > 0 && (
                  <div className="api-client__section">
                    <h5 className="api-client__section-title">Query Parameters</h5>
                    <table className="api-client__table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}></th>
                          <th>Parameter</th>
                          <th>Value</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queryParams.map((param, idx) => (
                          <tr key={idx} className={param.enabled ? '' : 'api-client__row--disabled'}>
                            <td>
                              <input
                                type="checkbox"
                                checked={param.enabled}
                                onChange={(e) => handleQueryParamChange(idx, 'enabled', e.target.checked)}
                              />
                            </td>
                            <td>
                              <code className="api-client__param-name">{param.key}</code>
                              {currentEndpoint.queryParams?.[idx]?.required && (
                                <span className="api-client__required">required</span>
                              )}
                            </td>
                            <td>
                              <input
                                type="text"
                                value={param.value}
                                onChange={(e) => handleQueryParamChange(idx, 'value', e.target.value)}
                                placeholder={currentEndpoint.queryParams?.[idx]?.example || 'Value'}
                              />
                            </td>
                            <td className="api-client__param-desc-cell">
                              {currentEndpoint.queryParams?.[idx]?.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Request Body */}
                {currentEndpoint.requestBody && (
                  <div className="api-client__section">
                    <div className="api-client__section-header">
                      <h5 className="api-client__section-title">Request Body</h5>
                      <span className="api-client__content-type">
                        {currentEndpoint.requestBody.contentType}
                      </span>
                    </div>
                    <p className="api-client__section-desc">
                      {currentEndpoint.requestBody.description}
                    </p>
                    <textarea
                      className="api-client__textarea"
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      rows={10}
                      spellCheck={false}
                    />
                  </div>
                )}

                {/* Expected Responses */}
                <div className="api-client__section">
                  <h5 className="api-client__section-title">Responses</h5>
                  <div className="api-client__responses-list">
                    {currentEndpoint.responses.map((res) => (
                      <div key={res.status} className="api-client__response-item">
                        <span
                          className={`api-client__status-badge ${res.status >= 200 && res.status < 300 ? 'api-client__status-badge--success' : 'api-client__status-badge--error'}`}
                        >
                          {res.status}
                        </span>
                        <span>{res.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Response Panel */}
              <div className="api-client__panel api-client__panel--response">
                <div className="api-client__panel-header">
                  <h5>Response</h5>
                  {response && (
                    <span
                      className={`api-client__status-badge ${response.status >= 200 && response.status < 300 ? 'api-client__status-badge--success' : 'api-client__status-badge--error'}`}
                    >
                      {response.status} {response.statusText}
                    </span>
                  )}
                </div>
                <div className="api-client__response-content">
                  {!response ? (
                    <div className="api-client__response-empty">
                      <span>Click "Send" to execute the request</span>
                    </div>
                  ) : (
                    <>
                      {response.headers && Object.keys(response.headers).length > 0 && (
                        <div className="api-client__response-headers">
                          <h6>Headers</h6>
                          <div className="api-client__headers-list">
                            {Object.entries(response.headers).map(([key, value]) => (
                              <div key={key} className="api-client__header-item">
                                <span className="api-client__header-key">{key}:</span>
                                <span className="api-client__header-value">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="api-client__response-body">
                        <h6>Body</h6>
                        <pre className="api-client__code-block">
                          {typeof response.data === 'string'
                            ? response.data
                            : JSON.stringify(response.data, null, 2)}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Icons
const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const LoadingIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="api-client__loading-icon"
  >
    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeLinecap="round" />
  </svg>
)
