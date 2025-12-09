import mapboxgl from 'mapbox-gl'
import type { GeoJsonFeatureCollection } from '@/lib/ngsi-ld/geoJsonHelpers'

export interface MarkerStyle {
  color?: string | null
  size?: number | null
  icon?: 'circle' | 'square' | 'triangle' | 'star' | 'pin' | null
}

export interface NgsiLayerConfig {
  id: string
  name: string
  data: GeoJsonFeatureCollection
  style: MarkerStyle
  popupTemplate?: string | null
}

/**
 * Manages NGSI-LD data layers on a Mapbox map
 */
export class MapboxLayerManager {
  private map: mapboxgl.Map
  private layers: Map<string, NgsiLayerConfig> = new Map()
  private popups: Map<string, mapboxgl.Popup> = new Map()

  constructor(map: mapboxgl.Map) {
    this.map = map
  }

  /**
   * Add or update an NGSI layer on the map
   */
  addOrUpdateLayer(config: NgsiLayerConfig): void {
    const sourceId = `ngsi-source-${config.id}`
    const layerId = `ngsi-layer-${config.id}`
    const symbolLayerId = `ngsi-symbol-${config.id}`

    // Store config for later reference
    this.layers.set(config.id, config)

    // Check if source already exists
    const existingSource = this.map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined

    if (existingSource) {
      // Update existing source data
      existingSource.setData(config.data as GeoJSON.FeatureCollection)
    } else {
      // Add new source
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: config.data as GeoJSON.FeatureCollection,
        cluster: config.data.features.length > 50,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      })

      // Add circle layer for points
      this.map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']], // Exclude clusters
        paint: {
          'circle-radius': config.style.size || 8,
          'circle-color': config.style.color || '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add cluster circle layer
      this.map.addLayer({
        id: `${layerId}-clusters`,
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': config.style.color || '#3b82f6',
          'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add cluster count labels
      this.map.addLayer({
        id: `${layerId}-cluster-count`,
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })

      // Add polygon/line layer if applicable
      this.map.addLayer({
        id: `${layerId}-fill`,
        type: 'fill',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': config.style.color || '#3b82f6',
          'fill-opacity': 0.3,
        },
      })

      this.map.addLayer({
        id: `${layerId}-line`,
        type: 'line',
        source: sourceId,
        filter: [
          'any',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['geometry-type'], 'Polygon'],
        ],
        paint: {
          'line-color': config.style.color || '#3b82f6',
          'line-width': 2,
        },
      })

      // Setup click handlers
      this.setupClickHandlers(layerId, config)
      this.setupClickHandlers(`${layerId}-clusters`, config, true)
    }
  }

  /**
   * Setup click handlers for popups and cluster zoom
   */
  private setupClickHandlers(layerId: string, config: NgsiLayerConfig, isCluster = false): void {
    // Cursor change on hover
    this.map.on('mouseenter', layerId, () => {
      this.map.getCanvas().style.cursor = 'pointer'
    })

    this.map.on('mouseleave', layerId, () => {
      this.map.getCanvas().style.cursor = ''
    })

    // Click handler
    this.map.on('click', layerId, (e) => {
      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
        number,
        number,
      ]

      // Ensure the popup appears at the correct location when map wraps
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
      }

      if (isCluster) {
        // Zoom into cluster
        const clusterId = feature.properties?.cluster_id
        const source = this.map.getSource(`ngsi-source-${config.id}`) as mapboxgl.GeoJSONSource
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          this.map.easeTo({
            center: coordinates,
            zoom: zoom ?? 14,
          })
        })
      } else {
        // Show popup
        this.showPopup(config, feature.properties, coordinates)
      }
    })
  }

  /**
   * Show popup for a feature
   */
  private showPopup(
    config: NgsiLayerConfig,
    properties: Record<string, unknown> | null,
    coordinates: [number, number],
  ): void {
    // Close existing popup for this layer
    const existingPopup = this.popups.get(config.id)
    if (existingPopup) {
      existingPopup.remove()
    }

    const content = this.renderPopupContent(config, properties)

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '300px',
    })
      .setLngLat(coordinates)
      .setHTML(content)
      .addTo(this.map)

    this.popups.set(config.id, popup)
  }

  /**
   * Render popup content using template or default format
   */
  private renderPopupContent(
    config: NgsiLayerConfig,
    properties: Record<string, unknown> | null,
  ): string {
    if (!properties) {
      return '<p>No data available</p>'
    }

    // Use template if provided
    if (config.popupTemplate) {
      return this.parseTemplate(config.popupTemplate, properties)
    }

    // Default format
    let html = `<div class="ngsi-popup">`
    html += `<h3 class="font-semibold text-sm mb-2">${properties.type || config.name}</h3>`
    html += `<div class="text-xs space-y-1">`

    for (const [key, value] of Object.entries(properties)) {
      if (key === 'id' || key === 'type') continue

      const displayValue = this.formatValue(value)
      const displayKey = this.formatKey(key)
      html += `<div><span class="font-medium">${displayKey}:</span> ${displayValue}</div>`
    }

    html += `</div></div>`
    return html
  }

  /**
   * Parse template string with {{path}} placeholders
   */
  private parseTemplate(template: string, properties: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(properties, path.trim())
      return this.formatValue(value)
    })
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, obj)
  }

  /**
   * Format value for display
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '-'
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(2)
    }
    return String(value)
  }

  /**
   * Format key for display (camelCase to Title Case)
   */
  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  /**
   * Update layer style
   */
  updateLayerStyle(layerId: string, style: MarkerStyle): void {
    const fullLayerId = `ngsi-layer-${layerId}`

    if (this.map.getLayer(fullLayerId)) {
      if (style.color) {
        this.map.setPaintProperty(fullLayerId, 'circle-color', style.color)
      }
      if (style.size) {
        this.map.setPaintProperty(fullLayerId, 'circle-radius', style.size)
      }
    }

    // Update stored config
    const config = this.layers.get(layerId)
    if (config) {
      config.style = { ...config.style, ...style }
    }
  }

  /**
   * Remove a layer from the map
   */
  removeLayer(layerId: string): void {
    const sourceId = `ngsi-source-${layerId}`
    const layers = [
      `ngsi-layer-${layerId}`,
      `ngsi-layer-${layerId}-clusters`,
      `ngsi-layer-${layerId}-cluster-count`,
      `ngsi-layer-${layerId}-fill`,
      `ngsi-layer-${layerId}-line`,
      `ngsi-symbol-${layerId}`,
    ]

    // Remove layers
    for (const layer of layers) {
      if (this.map.getLayer(layer)) {
        this.map.removeLayer(layer)
      }
    }

    // Remove source
    if (this.map.getSource(sourceId)) {
      this.map.removeSource(sourceId)
    }

    // Close popup
    const popup = this.popups.get(layerId)
    if (popup) {
      popup.remove()
      this.popups.delete(layerId)
    }

    this.layers.delete(layerId)
  }

  /**
   * Remove all layers
   */
  removeAllLayers(): void {
    for (const layerId of this.layers.keys()) {
      this.removeLayer(layerId)
    }
  }

  /**
   * Get all current layer IDs
   */
  getLayerIds(): string[] {
    return Array.from(this.layers.keys())
  }

  /**
   * Fit map bounds to show all features
   */
  fitToBounds(bounds: [number, number, number, number], options?: mapboxgl.FitBoundsOptions): void {
    this.map.fitBounds(bounds, {
      padding: 50,
      maxZoom: 15,
      ...options,
    })
  }
}
