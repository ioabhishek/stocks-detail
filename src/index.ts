import { Hono } from "hono"
import { cors } from "hono/cors"

type Env = {
  DB: D1Database // Cloudflare D1 Database
  KV: KVNamespace // Cloudflare KV Store
}

const app = new Hono<{ Bindings: Env }>() // ✅ Fix: Add type for env

app.use("*", cors()) // Allow all origins by default

app.post("/cache-stocks", async (c) => {
  try {
    const query = "SELECT * FROM stocks;"
    const results = await c.env.DB.prepare(query).all() // Fetch all stocks

    if (!results || results.results.length === 0) {
      return c.json({ error: "No stocks found" }, 404)
    }

    // 1️⃣ Store all stock data in KV (cache for 1 hour)
    await c.env.KV.put("all_stocks", JSON.stringify(results.results), {
      expirationTtl: 3600,
    })

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

app.post("/stock", async (c) => {
  try {
    const { tradingsymbol } = await c.req.json()
    if (!tradingsymbol) {
      return c.json({ error: "tradingsymbol is required" }, 400)
    }

    // 1️⃣ Get all stocks from KV
    const cachedStocks = await c.env.KV.get("all_stocks")
    if (cachedStocks) {
      const stocks = JSON.parse(cachedStocks)
      const stock = stocks.find((s: any) => s.tradingsymbol === tradingsymbol)
      if (stock) return c.json(stock)
    }

    // 2️⃣ If not found, fallback to D1 (optional)
    const query = `
      SELECT * FROM stocks WHERE tradingsymbol = ? LIMIT 1;`
    const result = await c.env.DB.prepare(query).bind(tradingsymbol).first()

    if (!result) {
      return c.json({ error: "Stock not found" }, 404)
    }

    return c.json(result)
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
