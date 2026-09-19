import { createServerFn } from '@tanstack/react-start'
import {
  listCatalogInputSchema,
  variantIdSchema,
} from '../../contracts/catalog'
import {
  getCatalogOptions,
  getCatalogVariant,
  listCatalogVariants,
} from '../../application/catalog'
import { requireWebSession } from '../auth.server'

export const listCatalogVariantsFn = createServerFn({ method: 'GET' })
  .validator(listCatalogInputSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    return listCatalogVariants(data)
  })

export const getCatalogVariantFn = createServerFn({ method: 'GET' })
  .validator(variantIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    return getCatalogVariant(data.variantId)
  })

export const getCatalogOptionsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireWebSession()
    return getCatalogOptions()
  },
)
