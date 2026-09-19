export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Desencadenado Training API',
    version: '0.1.0',
    description:
      'API personal para consultar el catálogo y preparar futuras integraciones de entrenamiento.',
  },
  servers: [{ url: '/api/v1' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
    schemas: {
      Problem: {
        type: 'object',
        required: ['type', 'title', 'status', 'detail', 'code', 'requestId'],
        properties: {
          type: { type: 'string', format: 'uri' },
          title: { type: 'string' },
          status: { type: 'integer' },
          detail: { type: 'string' },
          code: { type: 'string' },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
    },
  },
  paths: {
    '/exercise-variants': {
      get: {
        summary: 'Lista variantes',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          {
            name: 'exerciseType',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
          },
          {
            name: 'difficultyMin',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 5 },
          },
          {
            name: 'difficultyMax',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 5 },
          },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 24 },
          },
        ],
        responses: { '200': { description: 'Página de variantes' } },
      },
    },
    '/exercise-variants/{variantId}': {
      get: {
        summary: 'Detalle de una variante',
        parameters: [
          {
            name: 'variantId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Variante' },
          '404': { description: 'No encontrada' },
        },
      },
    },
    '/exercise-catalog-options': {
      get: {
        summary: 'Opciones y conteos de filtros',
        responses: { '200': { description: 'Opciones' } },
      },
    },
    '/capability-level-definitions': {
      get: {
        summary: 'Niveles y requisitos de evaluación',
        responses: { '200': { description: 'Definiciones' } },
      },
    },
    '/media-assets/{mediaId}/content': {
      get: {
        summary: 'Contenido de una imagen del catálogo',
        parameters: [
          {
            name: 'mediaId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': { description: 'Contenido binario' } },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'Este documento OpenAPI',
        responses: { '200': { description: 'Documento OpenAPI' } },
      },
    },
  },
} as const
