// Neon-backed, supabase-js-compatible data client.
//
// This deployment uses a Neon (serverless Postgres) database wired up through
// the Vercel Neon integration instead of Supabase. The frontend was written
// against the supabase-js fluent query API (`.from().select().eq()...`), so
// rather than rewrite ~100 call sites we implement the exact subset of that
// API the app uses, backed by Neon over HTTP.
//
// Supported per query: select / insert / update / upsert / delete,
// filters eq/neq/in/gt/gte/lt/lte/ilike/like/not(.is null)/or(PostgREST),
// modifiers order/limit/range, terminators single/maybeSingle, `{ count, head }`
// counts, upsert `{ onConflict }`, and `.rpc()`. No PostgREST embedded joins
// are used anywhere in this codebase, so none are implemented.
//
// Image storage (the Supabase `images` bucket) is emulated on Neon itself via
// a `storage_objects` (bytea) table + the `/api/images/[...key]` serving route,
// so the deployment needs no external blob store.

import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless"

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING

if (!connectionString) {
  throw new Error("Missing DATABASE_URL (Neon) environment variable")
}

// Match Supabase/PostgREST's JSON shapes so the existing call sites that
// expect numbers (location_x, score, find_count) and ISO date strings
// (created_at, found_at, last_synced_at) keep behaving identically. The raw
// pg driver would otherwise hand back NUMERIC/BIGINT as strings and
// TIMESTAMPTZ as Date objects.
types.setTypeParser(1700, (v: string | null) => (v === null ? null : parseFloat(v))) // numeric
types.setTypeParser(20, (v: string | null) => (v === null ? null : Number(v))) // int8 / bigint
const toIso = (v: string | null) => (v === null ? null : new Date(v).toISOString())
types.setTypeParser(1184, toIso) // timestamptz
types.setTypeParser(1114, toIso) // timestamp

// HTTP one-shot driver — ideal for serverless route handlers. `sql.query`
// takes positional ($1..) params and returns an array of row objects.
const sql: NeonQueryFunction<false, false> = neon(connectionString, { types })

export type DbError = { message: string; code?: string; details?: string } | null
export interface DbResult<T = any> {
  data: T
  error: DbError
  count: number | null
}

/** Replace `?` placeholders left-to-right with `$1..$n` (pg positional). */
function positional(text: string): string {
  let i = 0
  return text.replace(/\?/g, () => `$${++i}`)
}

async function run(text: string, params: any[]): Promise<any[]> {
  return (await sql.query(positional(text), params)) as any[]
}

const OPS: Record<string, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
  ilike: "ILIKE",
  is: "IS",
}

/* ----------------------------- PostgREST .or() ----------------------------- */
// Splits on top-level commas (ignoring commas inside parentheses).
function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === "(") depth++
    else if (c === ")") depth--
    else if (c === "," && depth === 0) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out.map((t) => t.trim()).filter(Boolean)
}

// Compiles a PostgREST boolean string into a SQL fragment using `?` params.
function compileOr(expr: string): { sql: string; params: any[] } {
  const compileTerm = (t: string): { sql: string; params: any[] } => {
    if (t.startsWith("and(") || t.startsWith("or(")) {
      const joiner = t.startsWith("and(") ? " AND " : " OR "
      const inner = t.slice(t.indexOf("(") + 1, t.lastIndexOf(")"))
      const parts = splitTop(inner).map(compileTerm)
      return {
        sql: "(" + parts.map((p) => p.sql).join(joiner) + ")",
        params: parts.flatMap((p) => p.params),
      }
    }
    const [col, op, ...rest] = t.split(".")
    const val = rest.join(".")
    const sqlOp = OPS[op] ?? "="
    if (op === "is") {
      return { sql: `${col} IS ${val.toLowerCase() === "null" ? "NULL" : val.toUpperCase()}`, params: [] }
    }
    return { sql: `${col} ${sqlOp} ?`, params: [val] }
  }
  const parts = splitTop(expr).map(compileTerm)
  return {
    sql: "(" + parts.map((p) => p.sql).join(" OR ") + ")",
    params: parts.flatMap((p) => p.params),
  }
}

/* ------------------------------ Query builder ------------------------------ */

type Mode = "select" | "insert" | "update" | "upsert" | "delete"

class QueryBuilder<T = any> implements PromiseLike<DbResult<T>> {
  private table: string
  private mode: Mode = "select"
  private columns = "*"
  private wantCount = false
  private headOnly = false
  private returning = false
  private payload: any = null
  private conflict: string | null = null
  private wheres: { sql: string; params: any[] }[] = []
  private orders: string[] = []
  private limitN: number | null = null
  private offsetN: number | null = null
  private singleRow: false | "single" | "maybe" = false

  constructor(table: string) {
    this.table = table
  }

  /* select() doubles as initial-query columns and as mutation RETURNING. */
  select(columns = "*", opts?: { count?: string; head?: boolean }) {
    this.columns = columns && columns.trim() ? columns : "*"
    if (this.mode !== "select") this.returning = true
    if (opts?.count) this.wantCount = true
    if (opts?.head) this.headOnly = true
    return this
  }

  insert(rows: any) {
    this.mode = "insert"
    this.payload = rows
    return this
  }
  update(values: any) {
    this.mode = "update"
    this.payload = values
    return this
  }
  upsert(rows: any, opts?: { onConflict?: string }) {
    this.mode = "upsert"
    this.payload = rows
    this.conflict = opts?.onConflict ?? null
    return this
  }
  delete() {
    this.mode = "delete"
    return this
  }

  private addFilter(col: string, op: string, val: any) {
    this.wheres.push({ sql: `${col} ${op} ?`, params: [val] })
    return this
  }
  eq(col: string, val: any) {
    if (val === null) return this.is(col, null)
    return this.addFilter(col, "=", val)
  }
  neq(col: string, val: any) {
    return this.addFilter(col, "<>", val)
  }
  gt(col: string, val: any) {
    return this.addFilter(col, ">", val)
  }
  gte(col: string, val: any) {
    return this.addFilter(col, ">=", val)
  }
  lt(col: string, val: any) {
    return this.addFilter(col, "<", val)
  }
  lte(col: string, val: any) {
    return this.addFilter(col, "<=", val)
  }
  like(col: string, val: any) {
    return this.addFilter(col, "LIKE", val)
  }
  ilike(col: string, val: any) {
    return this.addFilter(col, "ILIKE", val)
  }
  is(col: string, val: any) {
    const lit = val === null ? "NULL" : val === true ? "TRUE" : val === false ? "FALSE" : "NULL"
    this.wheres.push({ sql: `${col} IS ${lit}`, params: [] })
    return this
  }
  in(col: string, vals: any[]) {
    if (!Array.isArray(vals) || vals.length === 0) {
      this.wheres.push({ sql: "1 = 0", params: [] })
      return this
    }
    const ph = vals.map(() => "?").join(", ")
    this.wheres.push({ sql: `${col} IN (${ph})`, params: [...vals] })
    return this
  }
  not(col: string, op: string, val: any) {
    if (op === "is" && val === null) {
      this.wheres.push({ sql: `${col} IS NOT NULL`, params: [] })
      return this
    }
    const sqlOp = OPS[op] ?? "="
    this.wheres.push({ sql: `NOT (${col} ${sqlOp} ?)`, params: [val] })
    return this
  }
  or(expr: string) {
    this.wheres.push(compileOr(expr))
    return this
  }
  match(obj: Record<string, any>) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v)
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? "DESC" : "ASC"
    this.orders.push(`${col} ${dir}`)
    return this
  }
  limit(n: number) {
    this.limitN = n
    return this
  }
  range(from: number, to: number) {
    this.offsetN = from
    this.limitN = to - from + 1
    return this
  }
  single() {
    this.singleRow = "single"
    return this
  }
  maybeSingle() {
    this.singleRow = "maybe"
    return this
  }

  private whereClause(params: any[]): string {
    if (this.wheres.length === 0) return ""
    for (const w of this.wheres) params.push(...w.params)
    return " WHERE " + this.wheres.map((w) => w.sql).join(" AND ")
  }

  private buildSelect(): { text: string; params: any[] } {
    const params: any[] = []
    if (this.headOnly && this.wantCount) {
      let text = `SELECT count(*)::int AS count FROM ${this.table}`
      text += this.whereClause(params)
      return { text, params }
    }
    let text = `SELECT ${this.columns} FROM ${this.table}`
    text += this.whereClause(params)
    if (this.orders.length) text += " ORDER BY " + this.orders.join(", ")
    if (this.limitN != null) text += ` LIMIT ${Number(this.limitN)}`
    if (this.offsetN != null) text += ` OFFSET ${Number(this.offsetN)}`
    return { text, params }
  }

  private buildInsertLike(): { text: string; params: any[] } {
    const rows: any[] = Array.isArray(this.payload) ? this.payload : [this.payload]
    if (rows.length === 0) return { text: `SELECT 1 WHERE 1=0`, params: [] }
    const cols = Object.keys(rows[0])
    const params: any[] = []
    const valuesSql = rows
      .map((r) => "(" + cols.map((c) => {
        params.push(r[c] === undefined ? null : r[c])
        return "?"
      }).join(", ") + ")")
      .join(", ")
    let text = `INSERT INTO ${this.table} (${cols.join(", ")}) VALUES ${valuesSql}`
    if (this.mode === "upsert") {
      if (this.conflict) {
        const conflictCols = this.conflict.split(",").map((c) => c.trim())
        const updateCols = cols.filter((c) => !conflictCols.includes(c))
        const setSql = (updateCols.length ? updateCols : cols)
          .map((c) => `${c} = EXCLUDED.${c}`)
          .join(", ")
        text += ` ON CONFLICT (${conflictCols.join(", ")}) DO UPDATE SET ${setSql}`
      } else {
        text += ` ON CONFLICT DO NOTHING`
      }
    }
    if (this.returning) text += ` RETURNING ${this.columns}`
    return { text, params }
  }

  private buildUpdate(): { text: string; params: any[] } {
    const params: any[] = []
    const cols = Object.keys(this.payload)
    const setSql = cols
      .map((c) => {
        params.push(this.payload[c] === undefined ? null : this.payload[c])
        return `${c} = ?`
      })
      .join(", ")
    let text = `UPDATE ${this.table} SET ${setSql}`
    text += this.whereClause(params)
    if (this.returning) text += ` RETURNING ${this.columns}`
    return { text, params }
  }

  private buildDelete(): { text: string; params: any[] } {
    const params: any[] = []
    let text = `DELETE FROM ${this.table}`
    text += this.whereClause(params)
    if (this.returning) text += ` RETURNING ${this.columns}`
    return { text, params }
  }

  private build(): { text: string; params: any[] } {
    switch (this.mode) {
      case "insert":
      case "upsert":
        return this.buildInsertLike()
      case "update":
        return this.buildUpdate()
      case "delete":
        return this.buildDelete()
      default:
        return this.buildSelect()
    }
  }

  private async execute(): Promise<DbResult<T>> {
    try {
      const { text, params } = this.build()
      const rows = await run(text, params)

      if (this.headOnly && this.wantCount) {
        const count = rows.length ? Number((rows[0] as any).count) : 0
        return { data: null as T, error: null, count }
      }

      // Mutation with no RETURNING → supabase returns null data.
      if (this.mode !== "select" && !this.returning) {
        return { data: null as T, error: null, count: null }
      }

      if (this.singleRow === "single") {
        if (rows.length !== 1) {
          return {
            data: null as T,
            error: {
              message:
                rows.length === 0
                  ? "JSON object requested, multiple (or no) rows returned"
                  : "multiple rows returned for single()",
              code: rows.length === 0 ? "PGRST116" : "PGRST114",
            },
            count: null,
          }
        }
        return { data: rows[0] as T, error: null, count: null }
      }
      if (this.singleRow === "maybe") {
        if (rows.length > 1) {
          return { data: null as T, error: { message: "multiple rows returned", code: "PGRST114" }, count: null }
        }
        return { data: (rows[0] ?? null) as T, error: null, count: null }
      }

      return { data: rows as T, error: null, count: this.wantCount ? rows.length : null }
    } catch (err: any) {
      return { data: null as T, error: { message: err?.message ?? String(err), code: err?.code }, count: null }
    }
  }

  then<R1 = DbResult<T>, R2 = never>(
    onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

/* -------------------------------- Storage --------------------------------- */
// Emulates the slice of supabase storage the app uses, on Neon itself.

function storageFrom(bucket: string) {
  return {
    async upload(path: string, body: Buffer | Uint8Array | ArrayBuffer, opts?: { contentType?: string; upsert?: boolean }) {
      try {
        const key = `${bucket}/${path}`
        const buf = Buffer.isBuffer(body) ? body : Buffer.from(body as any)
        const hex = buf.toString("hex")
        const onConflict = opts?.upsert
          ? "DO UPDATE SET content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes"
          : "DO NOTHING"
        await run(
          `INSERT INTO storage_objects (key, content_type, bytes) VALUES (?, ?, decode(?, 'hex')) ON CONFLICT (key) ${onConflict}`,
          [key, opts?.contentType ?? "application/octet-stream", hex],
        )
        return { data: { path }, error: null as DbError }
      } catch (err: any) {
        return { data: null, error: { message: err?.message ?? String(err) } as DbError }
      }
    },
    getPublicUrl(path: string) {
      // Root-relative so next/image treats it as a local (same-origin) asset.
      return { data: { publicUrl: `/api/images/${bucket}/${path}` } }
    },
    async remove(paths: string[]) {
      try {
        for (const p of paths) {
          await run(`DELETE FROM storage_objects WHERE key = ?`, [`${bucket}/${p}`])
        }
        return { data: null, error: null as DbError }
      } catch (err: any) {
        return { data: null, error: { message: err?.message ?? String(err) } as DbError }
      }
    },
  }
}

/* -------------------------------- Client ---------------------------------- */

export class NeonClient {
  from<T = any>(table: string) {
    return new QueryBuilder<T>(table)
  }

  async rpc(fn: string, args?: Record<string, any>): Promise<DbResult> {
    try {
      const entries = Object.entries(args ?? {})
      const argSql = entries.map(([k]) => `${k} := ?`).join(", ")
      const params = entries.map(([, v]) => v)
      const rows = await run(`SELECT ${fn}(${argSql})`, params)
      return { data: rows, error: null, count: null }
    } catch (err: any) {
      return { data: null, error: { message: err?.message ?? String(err), code: err?.code }, count: null }
    }
  }

  storage = { from: storageFrom }
}

export type DbClient = NeonClient

/** Raw query escape hatch (positional `$1..` params), returns row array. */
export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  return (await sql.query(text, params)) as T[]
}

export function createNeonClient(): NeonClient {
  return new NeonClient()
}
