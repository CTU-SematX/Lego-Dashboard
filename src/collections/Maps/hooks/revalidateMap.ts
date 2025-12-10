import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

import type { Map } from '../../../payload-types'

export const revalidateMap: CollectionAfterChangeHook<Map> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === 'published') {
      const path = `/maps/${doc.slug}`

      payload.logger.info(`Revalidating map at path: ${path}`)

      await revalidatePath(path)
      await revalidateTag('maps-sitemap', 'default')
    }

    // If the map was previously published, we need to revalidate the old path
    if (previousDoc._status === 'published' && doc._status !== 'published') {
      const oldPath = `/maps/${previousDoc.slug}`

      payload.logger.info(`Revalidating old map at path: ${oldPath}`)

      await revalidatePath(oldPath)
      await revalidateTag('maps-sitemap', 'default')
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Map> = async ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    const path = `/maps/${doc?.slug}`

    await revalidatePath(path)
    await revalidateTag('maps-sitemap', 'default')
  }

  return doc
}
