'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

import type { Map } from '@/payload-types'

import { MapView } from '@/components/MapView'

interface MapPageClientProps {
  map: Map
}

const PageClient: React.FC<MapPageClientProps> = ({ map }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  }, [setHeaderTheme])

  return (
    <div className="fixed inset-0 top-[64px]">
      <MapView title={map.title} className="w-full h-full" />
    </div>
  )
}

export default PageClient
