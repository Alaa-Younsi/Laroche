import { defineConfig, loadEnv, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import type { ServerResponse } from 'node:http'
import path from 'node:path'
import { proxyEcotrack, type EcotrackEnv } from './api/_lib/ecotrack.ts'

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

  return {
    plugins: [react(), ecotrackDevProxy(ecotrackEnv)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
