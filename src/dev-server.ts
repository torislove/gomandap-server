import { serve } from '@hono/node-server'
import app from './index.ts'

const port = Number(process.env.PORT || 5000)
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
