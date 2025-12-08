'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface MapViewProps {
  title?: string
  className?: string
}

export const MapView: React.FC<MapViewProps> = ({ title, className }) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (map.current) return // Initialize map only once

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      console.error('Mapbox token is not defined')
      return
    }

    mapboxgl.accessToken = token

    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [105.7718, 10.0299], // Default center: Can Tho, Vietnam
        zoom: 12,
      })

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

      // Add fullscreen control
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')

      // Add scale control
      map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left')
    }

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      {title && (
        <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-gray-900/90 px-4 py-2 rounded-lg shadow-lg">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  )
}
