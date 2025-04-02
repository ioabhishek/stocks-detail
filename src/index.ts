import { Hono } from "hono"

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.post("/", async (c) => {
  try {
    const { tradingsymbol } = await c.req.json()
    console.log("tradingsymbol", tradingsymbol)
    if (!tradingsymbol) {
      return c.json({ error: "tradingsymbol is required" }, 400)
    }

    const query = `
      SELECT instrument_token, exchange_token, tradingsymbol, name, instrument_type, exchange 
      FROM stocks WHERE tradingsymbol = ?`

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
