import { Hono } from "hono"
import { cors } from "hono/cors"
import { Redis } from "@upstash/redis/cloudflare"

// Define the Stock type
type Stock = {
  instrument_token: number
  exchange_token: string
  tradingsymbol: string
  name: string
  instrument_type: string
  exchange: string
}

const app = new Hono()

app.use("*", cors())

// Use Cloudflare-compatible Upstash Redis
const redis = new Redis({
  url: "https://upright-grub-11809.upstash.io",
  token: "AS4hAAIjcDExMDAxYWU3N2FmZjM0ZjJkYmUwY2U5MGE3OGRiMWM4NXAxMA",
})

// Cache all stocks - expects JSON body in request
app.post("/cache-stocks", async (c) => {
  try {
    const stocks: Stock[] = await c.req.json()

    const pipeline = redis.pipeline()
    for (const stock of stocks) {
      pipeline.set(stock.tradingsymbol, stock, { ex: 3600 })
    }
    await pipeline.exec()

    return c.json({ success: true, message: "Stock data cached successfully!" })
  } catch (error) {
    return c.json(
      {
        error: "Failed to cache stock data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    )
  }
})

// Get individual stock by tradingsymbol
app.post("/stock", async (c) => {
  try {
    const { tradingsymbol } = await c.req.json()
    if (!tradingsymbol) {
      return c.json({ error: "tradingsymbol is required" }, 400)
    }

    const stock = await redis.get<Stock>(tradingsymbol)
    if (!stock) {
      return c.json({ error: "Stock not found" }, 404)
    }

    return c.json(stock)
  } catch (error) {
    return c.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    )
  }
})

export default app
