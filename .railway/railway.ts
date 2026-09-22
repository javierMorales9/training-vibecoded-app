import { defineRailway, github, project, service, volume } from 'railway/iac'

export default defineRailway(() => {
  const trainingData = volume('training-data', {
    region: 'europe-west4-drams3a',
    sizeMB: 1024,
  })

  const app = service('desencadenado', {
    source: github('javierMorales9/training-vibecoded-app', {
      branch: 'main',
    }),
    healthcheck: '/healthz',
    healthcheckTimeout: 60,
    replicas: { 'europe-west4-drams3a': 1 },
    volumeMounts: {
      '/app/data': trainingData,
    },
    env: {
      NODE_ENV: 'production',
      DATABASE_PATH: '/app/data/training.sqlite',
      LOCAL_MEDIA_PATH: '/app/files',
      LOG_LEVEL: 'info',
    },
  })

  return project('desencadenado', {
    resources: [app, trainingData],
  })
})
