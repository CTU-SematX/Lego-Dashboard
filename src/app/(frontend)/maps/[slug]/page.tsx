import type { Metadata } from 'next'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'

import type { Map } from '@/payload-types'

import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const maps = await payload.find({
    collection: 'maps',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const params = maps.docs.map(({ slug }) => {
    return { slug }
  })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function MapPage({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/maps/' + decodedSlug
  const map = await queryMapBySlug({ slug: decodedSlug })

  if (!map) return <PayloadRedirects url={url} />

  // Fetch all maps for sidebar navigation
  const allMaps = await queryAllMaps()

  return (
    <>
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <PageClient map={map} allMaps={allMaps} />
    </>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const map = await queryMapBySlug({ slug: decodedSlug })

  return generateMeta({ doc: map })
}

const queryMapBySlug = cache(async ({ slug }: { slug: string }): Promise<Map | null> => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'maps',
    draft,
    limit: 1,
    depth: 3, // Populate layers with dataModel, source, and entities relationships
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})

const queryAllMaps = cache(async (): Promise<{ title: string; slug: string }[]> => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'maps',
    draft,
    limit: 100,
    overrideAccess: draft,
    pagination: false,
    select: {
      title: true,
      slug: true,
    },
  })

  return result.docs.map((doc) => ({
    title: String(doc.title || ''),
    slug: String(doc.slug || ''),
  }))
})
