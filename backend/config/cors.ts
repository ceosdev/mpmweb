import env from '#start/env'
import { defineConfig } from '@adonisjs/cors'

/**
 * CORS policy. Only the frontend origin (Vercel in production,
 * Vite dev server locally) is allowed to call the API.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: [env.get('FRONTEND_URL')],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
