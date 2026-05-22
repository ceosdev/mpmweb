import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

/**
 * Database configuration.
 *
 * In production (Railway) a single `DATABASE_URL` connection string is used.
 * Locally the individual `DB_*` variables point to the developer's own
 * PostgreSQL instance.
 */
const databaseUrl = env.get('DATABASE_URL')

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: databaseUrl
        ? {
            connectionString: databaseUrl,
            ssl: env.get('DB_SSL', false) ? { rejectUnauthorized: false } : undefined,
          }
        : {
            host: env.get('DB_HOST', 'localhost'),
            port: env.get('DB_PORT', 5432),
            user: env.get('DB_USER', 'postgres'),
            password: env.get('DB_PASSWORD', 'postgres'),
            database: env.get('DB_DATABASE', 'mpmweb'),
          },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      debug: false,
    },
  },
})

export default dbConfig
