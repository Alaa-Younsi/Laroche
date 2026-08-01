import { defineConfig, loadEnv, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import type { ServerResponse } from 'node:http'
import path from 'node:path'
import { proxyEcotrack, type EcotrackEnv } from './api/_lib/ecotrack.ts'
import {
  createCheckoutForOrder,
  handleWebhook,
  readChargilyEnv,
  type ChargilyEnv,
} from './api/_lib/chargily.ts'
import {
  createWorker,
  readAdminTeamEnv,
  type AdminTeamEnv,
  type CreateWorkerBody,
} from './api/_lib/adminTeam.ts'

// Mirrors the Vercel Edge function at /api/ecotrack/* during `bun run dev`,
// so the ECOTRACK integration is testable locally without `vercel dev`. The
// token is read from .env server-side and never exposed to the client bundle.
function ecotrackDevProxy(env: EcotrackEnv): Plugin {
  return {
    name: 'ecotrack-dev-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/ecotrack',
        async (req: Connect.IncomingMessage, res: ServerResponse) => {
          // connect strips the mount prefix, so req.url starts at the subpath
          const parsed = new URL(req.url ?? '/', 'http://localhost')
          const subpath = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '')
          const jwt =
            (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || undefined

          let body: string | undefined
          if (req.method === 'POST') {
            body = await new Promise<string>((resolve) => {
              let data = ''
              req.on('data', (chunk) => (data += chunk))
              req.on('end', () => resolve(data))
            })
          }

          const result = await proxyEcotrack(
            { method: req.method ?? 'GET', subpath, search: parsed.searchParams, body, jwt },
            env,
          )
          res.statusCode = result.status
          res.setHeader('Content-Type', result.contentType)
          res.setHeader('Cache-Control', 'no-store')
          res.end(Buffer.from(result.body))
        },
      )
    },
  }
}

// Mirrors the Vercel Edge functions at /api/chargily/* during `bun run dev`,
// so the payment flow (checkout create + webhook) is testable locally without
// `vercel dev`. Secret keys are read from .env server-side, never bundled.
function chargilyDevProxy(env: ChargilyEnv): Plugin {
  return {
    name: 'chargily-dev-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/chargily',
        async (req: Connect.IncomingMessage, res: ServerResponse) => {
          const parsed = new URL(req.url ?? '/', 'http://localhost')
          const route = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '')

          let body = ''
          if (req.method === 'POST') {
            body = await new Promise<string>((resolve) => {
              let data = ''
              req.on('data', (chunk) => (data += chunk))
              req.on('end', () => resolve(data))
            })
          }

          const send = (status: number, obj: unknown) => {
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify(obj))
          }

          if (route === 'checkout' && req.method === 'POST') {
            let parsedBody: { order_number?: string }
            try {
              parsedBody = JSON.parse(body || '{}')
            } catch {
              return send(400, { error: 'Invalid JSON' })
            }
            const result = await createCheckoutForOrder(env, {
              orderNumber: parsedBody.order_number ?? '',
              origin: `http://${req.headers.host ?? 'localhost:5173'}`,
            })
            return send(result.status, result.body)
          }

          if (route === 'webhook' && req.method === 'POST') {
            const signature = (req.headers['signature'] as string | undefined) ?? null
            const result = await handleWebhook(env, body, signature)
            return send(result.status, result.body)
          }

          send(404, { error: 'Not found' })
        },
      )
    },
  }
}

// Mirrors the Vercel Edge function at /api/admin/* during `bun run dev`, so
// staff-account creation is testable locally without `vercel dev`. The
// service-role key is read from .env server-side, never bundled.
function adminDevProxy(env: AdminTeamEnv): Plugin {
  return {
    name: 'admin-dev-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/admin',
        async (req: Connect.IncomingMessage, res: ServerResponse) => {
          const parsed = new URL(req.url ?? '/', 'http://localhost')
          const route = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '')

          const send = (status: number, obj: unknown) => {
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify(obj))
          }

          if (route !== 'create-worker') return send(404, { code: 'not_found' })
          if (req.method !== 'POST') return send(405, { code: 'method_not_allowed' })

          const raw = await new Promise<string>((resolve) => {
            let data = ''
            req.on('data', (chunk) => (data += chunk))
            req.on('end', () => resolve(data))
          })

          let body: CreateWorkerBody
          try {
            body = JSON.parse(raw || '{}')
          } catch {
            return send(400, { code: 'invalid_json' })
          }

          const jwt =
            (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || null
          const result = await createWorker(env, { jwt, body })
          send(result.status, result.body)
        },
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // load ALL env (no prefix filter) so server-only vars reach the dev proxy
  const env = loadEnv(mode, process.cwd(), '')
  const ecotrackEnv: EcotrackEnv = {
    apiToken: env.ECOTRACK_API_TOKEN ?? '',
    apiUrl: env.ECOTRACK_API_URL ?? 'https://app.ecotrack.dz',
    supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? '',
  }
  const chargilyEnv = readChargilyEnv((k) => env[k])
  const adminTeamEnv = readAdminTeamEnv((k) => env[k])

  return {
    plugins: [
      react(),
      ecotrackDevProxy(ecotrackEnv),
      chargilyDevProxy(chargilyEnv),
      adminDevProxy(adminTeamEnv),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
