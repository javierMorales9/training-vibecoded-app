export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Desencadenado Training API',
    version: '0.3.0',
    description:
      'API personal para consultar el catálogo y las evaluaciones, y gestionar la cola de entrenamientos pendientes.',
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
      ExerciseSelection: {
        oneOf: [
          {
            type: 'object',
            required: ['kind', 'exerciseVariantId'],
            properties: {
              kind: { const: 'EXPLICIT_VARIANT' },
              exerciseVariantId: {
                type: ['string', 'null'],
                format: 'uuid',
              },
            },
          },
          {
            type: 'object',
            required: ['kind', 'capability', 'levelOffset'],
            properties: {
              kind: { const: 'CAPABILITY_RELATIVE' },
              capability: {
                type: ['string', 'null'],
                enum: [
                  'PUSH_UP',
                  'VERTICAL_PUSH',
                  'PULL_UP',
                  'SQUAT',
                  'ABDOMINAL',
                  null,
                ],
              },
              levelOffset: {
                type: ['integer', 'null'],
                enum: [-1, 0, 1, null],
              },
            },
          },
        ],
      },
      WorkoutTarget: {
        type: 'object',
        required: [
          'unitIndex',
          'label',
          'metricKind',
          'scope',
          'minimumValue',
          'maximumValue',
        ],
        properties: {
          unitIndex: { type: ['integer', 'null'], minimum: 0 },
          label: { type: 'string', maxLength: 120 },
          metricKind: {
            type: 'string',
            enum: ['REPETITIONS', 'DURATION'],
          },
          scope: {
            type: 'string',
            enum: ['TOTAL', 'PER_SIDE', 'PER_HAND', 'PER_LEG'],
          },
          minimumValue: { type: 'integer', minimum: 1 },
          maximumValue: { type: 'integer', minimum: 1 },
        },
      },
      WorkoutBlockItem: {
        type: 'object',
        required: ['selection', 'targets'],
        properties: {
          selection: { $ref: '#/components/schemas/ExerciseSelection' },
          targets: {
            type: 'array',
            maxItems: 500,
            items: { $ref: '#/components/schemas/WorkoutTarget' },
          },
        },
      },
      WorkoutBlock: {
        oneOf: [
          {
            type: 'object',
            required: [
              'method',
              'name',
              'instructions',
              'afterBlockRestMs',
              'unitCount',
              'betweenUnitsRestMs',
              'items',
            ],
            properties: {
              method: { type: 'string', enum: ['NORMAL_SETS', 'SUPERSET'] },
              name: { type: ['string', 'null'], maxLength: 120 },
              instructions: { type: ['string', 'null'], maxLength: 2000 },
              afterBlockRestMs: { type: ['integer', 'null'], minimum: 0 },
              unitCount: { type: ['integer', 'null'], minimum: 1 },
              betweenUnitsRestMs: {
                type: ['integer', 'null'],
                minimum: 0,
              },
              items: {
                type: 'array',
                maxItems: 2,
                items: { $ref: '#/components/schemas/WorkoutBlockItem' },
              },
            },
          },
          {
            type: 'object',
            required: [
              'method',
              'name',
              'instructions',
              'afterBlockRestMs',
              'pyramidDurationMs',
              'pyramidInitialReps',
              'pyramidRestMsPerRep',
              'items',
            ],
            properties: {
              method: { const: 'PYRAMID' },
              name: { type: ['string', 'null'], maxLength: 120 },
              instructions: { type: ['string', 'null'], maxLength: 2000 },
              afterBlockRestMs: { type: ['integer', 'null'], minimum: 0 },
              pyramidDurationMs: { type: ['integer', 'null'], minimum: 1 },
              pyramidInitialReps: { type: ['integer', 'null'], minimum: 1 },
              pyramidRestMsPerRep: {
                type: ['integer', 'null'],
                minimum: 1,
              },
              items: {
                type: 'array',
                maxItems: 1,
                items: { $ref: '#/components/schemas/WorkoutBlockItem' },
              },
            },
          },
        ],
      },
      WorkoutInput: {
        type: 'object',
        required: ['name', 'notes', 'blocks'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          notes: { type: ['string', 'null'], maxLength: 2000 },
          blocks: {
            type: 'array',
            maxItems: 50,
            items: { $ref: '#/components/schemas/WorkoutBlock' },
          },
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
          {
            name: 'primaryProgression',
            in: 'query',
            description:
              'Filtra variantes de la progresión principal o complementarias.',
            schema: { type: 'boolean' },
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
    '/assessments': {
      get: {
        summary: 'Historial de evaluaciones',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
              },
            },
          },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        ],
        responses: { '200': { description: 'Página de evaluaciones' } },
      },
    },
    '/assessments/{assessmentId}': {
      get: {
        summary: 'Detalle de una evaluación',
        parameters: [
          {
            name: 'assessmentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Evaluación con resultados congelados' },
          '404': { description: 'No encontrada' },
        },
      },
    },
    '/current-capability-levels': {
      get: {
        summary: 'Niveles actuales de las cinco capacidades',
        responses: { '200': { description: 'Niveles derivados' } },
      },
    },
    '/workout-queue': {
      get: {
        summary: 'Cola completa de entrenamientos pendientes',
        responses: {
          '200': {
            description: 'Cola y versión actual',
            headers: { ETag: { schema: { type: 'string' } } },
          },
        },
      },
      put: {
        summary: 'Reemplaza atómicamente el orden de la cola',
        parameters: [
          {
            name: 'If-Match',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['workoutIds'],
                properties: {
                  workoutIds: {
                    type: 'array',
                    items: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Cola reordenada' },
          '409': { description: 'La lista no coincide con la cola actual' },
          '412': { description: 'Versión desactualizada' },
          '428': { description: 'Falta If-Match' },
        },
      },
    },
    '/workouts': {
      post: {
        summary: 'Crea un entrenamiento al final de la cola',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', maxLength: 128 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WorkoutInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Entrenamiento creado',
            headers: {
              Location: { schema: { type: 'string' } },
              ETag: { schema: { type: 'string' } },
            },
          },
          '409': { description: 'Clave idempotente reutilizada' },
          '428': { description: 'Falta Idempotency-Key' },
        },
      },
    },
    '/workouts/{workoutId}': {
      parameters: [
        {
          name: 'workoutId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      get: {
        summary: 'Obtiene un entrenamiento pendiente completo',
        responses: {
          '200': {
            description: 'Entrenamiento editable',
            headers: { ETag: { schema: { type: 'string' } } },
          },
          '404': { description: 'No encontrado' },
        },
      },
      put: {
        summary: 'Sustituye el entrenamiento completo',
        parameters: [
          {
            name: 'If-Match',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WorkoutInput' },
            },
          },
        },
        responses: {
          '200': { description: 'Entrenamiento actualizado' },
          '404': { description: 'No encontrado' },
          '412': { description: 'Versión desactualizada' },
          '428': { description: 'Falta If-Match' },
        },
      },
      delete: {
        summary: 'Elimina un entrenamiento pendiente',
        parameters: [
          {
            name: 'If-Match',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '204': { description: 'Eliminado' },
          '404': { description: 'No encontrado' },
          '412': { description: 'Versión desactualizada' },
          '428': { description: 'Falta If-Match' },
        },
      },
    },
    '/workouts/{workoutId}/duplicate': {
      post: {
        summary: 'Duplica un entrenamiento tras el original',
        parameters: [
          {
            name: 'workoutId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', maxLength: 128 },
          },
        ],
        responses: {
          '201': { description: 'Copia creada' },
          '404': { description: 'Original no encontrado' },
          '409': { description: 'Clave idempotente reutilizada' },
          '428': { description: 'Falta Idempotency-Key' },
        },
      },
    },
    '/workouts/{workoutId}/validation': {
      get: {
        summary: 'Valida si un entrenamiento podría iniciarse',
        parameters: [
          {
            name: 'workoutId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Resultado y conflictos de validación' },
          '404': { description: 'No encontrado' },
        },
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
