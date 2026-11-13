// A stand-in for Supabase on your own machine, for development and end-to-end checks.
// It runs the real schema (migrations + geo seed) in an in-process Postgres (PGlite) and
// speaks enough of the Supabase HTTP API (PostgREST queries, RPC, e-mail code sign-in,
// storage) for the app to run against it, row level security included.
//
//   node scripts/dev-backend.mjs            # http://localhost:54321, any 6-digit code signs in
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dev-anon \
//   SUPABASE_SERVICE_ROLE_KEY=dev-service npm run dev
//
// Not a security boundary and not for production: tokens are not verified.
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.DEV_BACKEND_PORT || 54321);
const SCHEMA = "politique";
const root = new URL("../", import.meta.url);

export async function createDb() {
  const db = new PGlite({ extensions: { citext, pg_trgm, unaccent } });
  await db.exec(`
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, phone text, raw_user_meta_data jsonb, created_at timestamptz default now());
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
    create or replace function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    create or replace function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    create publication supabase_realtime;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  `);
  const dir = new URL("supabase/migrations/", root);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(f, dir), "utf8"));
  }
  await db.exec(readFileSync(new URL("supabase/seed/ci_geo.sql", root), "utf8"));
  await db.exec(`
    reset search_path;
    grant usage on schema auth, storage to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    grant select on auth.users to service_role;
  `);
  return db;
}

// --- tiny JWT (unsigned) ------------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const mint = (claims) => `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.dev`;
function claimsOf(req) {
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const key = auth || req.headers.apikey || "";
  if (key === "dev-service") return { role: "service_role" };
  try {
    const c = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
    if (c.sub) return { role: "authenticated", sub: c.sub, email: c.email };
  } catch {}
  return { role: "anon" };
}

// --- PostgREST subset -----------------------------------------------------------
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw httpError(400, `bad identifier ${s}`);
  return `"${s}"`;
};
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, body: { message, ...extra } });

function splitTop(s) {
  const out = [];
  let depth = 0, cur = "", q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (!q && (ch === "(" || ch === "{")) depth++;
    if (!q && (ch === ")" || ch === "}")) depth--;
    if (ch === "," && depth === 0 && !q) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
const unq = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\"/g, '"') : v);

function cond(col, expr, params) {
  let neg = false;
  if (expr.startsWith("not.")) { neg = true; expr = expr.slice(4); }
  const i = expr.indexOf(".");
  const op = expr.slice(0, i), val = expr.slice(i + 1);
  const c = ident(col);
  const p = (v) => { params.push(v); return `$${params.length}`; };
  let sql;
  switch (op) {
    case "eq": sql = `${c} = ${p(val)}`; break;
    case "neq": sql = `${c} <> ${p(val)}`; break;
    case "gt": sql = `${c} > ${p(val)}`; break;
    case "gte": sql = `${c} >= ${p(val)}`; break;
    case "lt": sql = `${c} < ${p(val)}`; break;
    case "lte": sql = `${c} <= ${p(val)}`; break;
    case "like": sql = `${c} like ${p(val.replace(/\*/g, "%"))}`; break;
    case "ilike": sql = `${c} ilike ${p(val.replace(/\*/g, "%"))}`; break;
    case "is": sql = `${c} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`; break;
    case "in": {
      const items = splitTop(val.slice(1, -1)).map(unq);
      sql = items.length ? `${c} in (${items.map(p).join(",")})` : "false";
      break;
    }
    case "cs": sql = `${c} @> ${p(val)}`; break;
    case "cd": sql = `${c} <@ ${p(val)}`; break;
    default: throw httpError(400, `unsupported operator ${op}`);
  }
  return neg ? `not (${sql})` : sql;
}
function logic(kind, body, params) {
  const parts = splitTop(body.slice(1, -1)).map((part) => {
    const m = /^(and|or)(\(.*\))$/s.exec(part);
    if (m) return logic(m[1], m[2], params);
    const i = part.indexOf(".");
    return cond(part.slice(0, i), part.slice(i + 1), params);
  });
  return `(${parts.join(kind === "or" ? " or " : " and ")})`;
}
function whereOf(q, params) {
  const out = [];
  for (const [k, v] of q) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    if (k === "or" || k === "and") out.push(logic(k, v, params));
    else out.push(cond(k, v, params));
  }
  return out.length ? ` where ${out.join(" and ")}` : "";
}
const colsOf = (sel) => (!sel || sel === "*" ? "*" : sel.split(",").map((c) => (c.trim() === "*" ? "*" : ident(c.trim()))).join(", "));
function tailOf(q) {
  let s = "";
  const order = q.get("order");
  if (order) s += ` order by ${order.split(",").map((o) => { const [c, dir, nulls] = o.split("."); return `${ident(c)} ${dir === "desc" ? "desc" : "asc"}${nulls === "nullsfirst" ? " nulls first" : nulls === "nullslast" ? " nulls last" : ""}`; }).join(", ")}`;
  if (q.get("limit")) s += ` limit ${Number(q.get("limit"))}`;
  if (q.get("offset")) s += ` offset ${Number(q.get("offset"))}`;
  return s;
}

async function rest(tx, req, table, q, body) {
  const t = `${SCHEMA}.${ident(table)}`;
  const params = [];
  const prefer = req.headers.prefer || "";
  const wantRows = req.method === "GET" || /return=representation/.test(prefer);
  let core;
  if (req.method === "GET") {
    core = `select ${colsOf(q.get("select"))} from ${t}${whereOf(q, params)}${tailOf(q)}`;
  } else if (req.method === "POST") {
    const rows = Array.isArray(body) ? body : [body];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    params.push(JSON.stringify(rows));
    let conflict = "";
    if (/resolution=merge-duplicates/.test(prefer)) {
      let keys = q.get("on_conflict")?.split(",");
      if (!keys) {
        const pk = await tx.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = $1::regclass and i.indisprimary`, [`${SCHEMA}.${table}`]);
        keys = pk.rows.map((r) => r.attname);
      }
      const set = cols.filter((c) => !keys.includes(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`);
      conflict = ` on conflict (${keys.map(ident).join(",")}) ${set.length ? `do update set ${set.join(", ")}` : "do nothing"}`;
    }
    const list = cols.map(ident).join(", ");
    core = `with r as (insert into ${t} (${list}) select ${list} from json_populate_recordset(null::${t}, $1::json)${conflict} returning *) select ${colsOf(q.get("select"))} from r`;
  } else if (req.method === "PATCH") {
    const cols = Object.keys(body);
    params.push(JSON.stringify(body));
    const list = cols.map(ident).join(", ");
    core = `with r as (update ${t} set (${list}) = (select ${list} from json_populate_record(null::${t}, $1::json))${whereOf(q, params)} returning *) select ${colsOf(q.get("select"))} from r`;
  } else if (req.method === "DELETE") {
    core = `with r as (delete from ${t}${whereOf(q, params)} returning *) select ${colsOf(q.get("select"))} from r`;
  } else throw httpError(405, "method");
  const res = await tx.query(`select coalesce(json_agg(x), '[]'::json) as j from (${core}) x`, params);
  const rows = res.rows[0].j;
  if (!wantRows) return { status: req.method === "POST" ? 201 : 204, body: null };
  if ((req.headers.accept || "").includes("vnd.pgrst.object")) {
    if (rows.length !== 1) throw httpError(406, "JSON object requested, multiple (or no) rows returned", { code: "PGRST116", details: `The result contains ${rows.length} rows` });
    return { status: 200, body: rows[0] };
  }
  return { status: req.method === "POST" ? 201 : 200, body: rows };
}

async function rpc(tx, req, fn, args) {
  const meta = await tx.query(
    `select p.proretset, p.prorettype::regtype::text as ret, t.typtype, coalesce(p.proargnames, '{}') as names,
            array(select format_type(x, null) from unnest(p.proargtypes::oid[]) x) as types
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
      where n.nspname = $1 and p.proname = $2 order by p.pronargs desc limit 1`, [SCHEMA, fn]);
  if (!meta.rows.length) throw httpError(404, `function ${fn} not found`, { code: "PGRST202" });
  const m = meta.rows[0];
  const params = [];
  const named = Object.entries(args || {}).map(([k, v]) => {
    const type = m.types[m.names.indexOf(k)] || "text";
    let val = v;
    if (v !== null && typeof v === "object") val = type.endsWith("[]") ? `{${v.map((x) => JSON.stringify(String(x))).join(",")}}` : JSON.stringify(v);
    else if (v !== null) val = String(v);
    params.push(val);
    return `${ident(k)} := $${params.length}::${type}`;
  });
  const call = `${SCHEMA}.${ident(fn)}(${named.join(", ")})`;
  if (m.ret === "void") { await tx.query(`select ${call}`, params); return { status: 204, body: null }; }
  const isTable = m.proretset || m.ret === "record";
  if (isTable) {
    const r = await tx.query(`select coalesce(json_agg(x), '[]'::json) as j from ${call} x`, params);
    return { status: 200, body: r.rows[0].j };
  }
  const r = m.typtype === "c" ? await tx.query(`select to_json(x) as j from ${call} x`, params) : await tx.query(`select to_json(${call}) as j`, params);
  return { status: 200, body: r.rows[0].j };
}

// --- server -------------------------------------------------------------------
export async function startBackend({ port = PORT, quiet = false } = {}) {
  const db = await createDb();
  const files = new Map(); // "bucket/path" -> { type, data }
  let chain = Promise.resolve();
  const serial = (fn) => (chain = chain.then(fn, fn));

  const session = (user) => {
    const exp = Math.floor(Date.now() / 1000) + 30 * 86400;
    const u = { id: user.id, aud: "authenticated", role: "authenticated", email: user.email, user_metadata: user.raw_user_meta_data || {}, app_metadata: {}, created_at: user.created_at };
    return { access_token: mint({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp }), token_type: "bearer", expires_in: 30 * 86400, expires_at: exp, refresh_token: `r-${user.id}`, user: u };
  };

  async function auth(req, path, q, body, claims) {
    if (path === "/otp" && req.method === "POST") {
      const email = String(body.email || "").toLowerCase();
      const found = await db.query(`select id from auth.users where email = $1`, [email]);
      if (!found.rows.length) {
        if (body.create_user === false) throw httpError(422, "Signups not allowed for otp", { code: 422, msg: "Signups not allowed for otp" });
        await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2)`, [email, body.data || {}]);
      }
      return { status: 200, body: {} };
    }
    if (path === "/verify" && req.method === "POST") {
      const r = await db.query(`select * from auth.users where email = $1`, [String(body.email || "").toLowerCase()]);
      if (!r.rows.length || !/^\d{6,8}$/.test(String(body.token || ""))) throw httpError(403, "Token has expired or is invalid", { code: 403, msg: "Token has expired or is invalid" });
      return { status: 200, body: session(r.rows[0]) };
    }
    if (path === "/token" && req.method === "POST") {
      const r = await db.query(`select * from auth.users where id = $1`, [String(body.refresh_token || "").slice(2)]);
      if (!r.rows.length) throw httpError(400, "Invalid Refresh Token");
      return { status: 200, body: session(r.rows[0]) };
    }
    if (path === "/user" && req.method === "GET") {
      if (!claims.sub) throw httpError(401, "invalid JWT");
      const r = await db.query(`select * from auth.users where id = $1`, [claims.sub]);
      if (!r.rows.length) throw httpError(401, "user not found");
      return { status: 200, body: session(r.rows[0]).user };
    }
    if (path === "/logout") return { status: 204, body: null };
    throw httpError(404, "auth route");
  }

  function storage(req, path, raw, type) {
    let m;
    if (req.method === "POST" && (m = /^\/object\/sign\/([^/]+)$/.exec(path))) {
      const body = JSON.parse(raw.toString() || "{}");
      return { status: 200, body: (body.paths || []).map((p) => ({ path: p, error: null, signedURL: `/object/sign/${m[1]}/${p}?token=dev` })) };
    }
    if (req.method === "POST" && (m = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(path))) return { status: 200, body: { signedURL: `/object/sign/${m[1]}/${m[2]}?token=dev` } };
    if (req.method === "GET" && (m = /^\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/.exec(path))) {
      const f = files.get(`${m[1]}/${decodeURIComponent(m[2])}`);
      if (!f) throw httpError(404, "Object not found");
      return { status: 200, raw: f.data, type: f.type };
    }
    if ((req.method === "POST" || req.method === "PUT") && (m = /^\/object\/([^/]+)\/(.+)$/.exec(path))) {
      let data = raw, ctype = type || "application/octet-stream";
      if (ctype.startsWith("multipart/form-data")) {
        // supabase-js sends File/Blob bodies as multipart: keep the first part's bytes.
        const boundary = Buffer.from("--" + ctype.split("boundary=")[1]);
        const start = raw.indexOf("\r\n\r\n", raw.indexOf(boundary)) + 4;
        const head = raw.subarray(0, start).toString();
        ctype = /content-type:\s*([^\r\n]+)/i.exec(head)?.[1] || "application/octet-stream";
        data = raw.subarray(start, raw.indexOf(boundary, start) - 2);
      }
      files.set(`${m[1]}/${decodeURIComponent(m[2])}`, { type: ctype, data });
      return { status: 200, body: { Key: `${m[1]}/${m[2]}`, Id: randomUUID() } };
    }
    throw httpError(404, "storage route");
  }

  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => serial(async () => {
      const cors = { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "access-control-expose-headers": "*" };
      const send = (status, body, extra = {}) => {
        res.writeHead(status, { ...cors, ...(body === null || body === undefined ? {} : { "content-type": "application/json" }), ...extra });
        res.end(body === null || body === undefined ? undefined : JSON.stringify(body));
      };
      if (req.method === "OPTIONS") return send(204, null);
      const url = new URL(req.url, "http://x");
      const raw = Buffer.concat(chunks);
      const claims = claimsOf(req);
      try {
        let out;
        if (url.pathname.startsWith("/storage/v1/")) {
          out = storage(req, url.pathname.slice(11), raw, req.headers["content-type"]);
          if (out.raw) { res.writeHead(200, { ...cors, "content-type": out.type, "cache-control": "max-age=3600" }); return res.end(out.raw); }
        } else {
          const body = raw.length ? JSON.parse(raw.toString()) : null;
          if (url.pathname.startsWith("/auth/v1/")) out = await auth(req, url.pathname.slice(8), url.searchParams, body || {}, claims);
          else if (url.pathname.startsWith("/rest/v1/")) {
            const name = url.pathname.slice(9);
            out = await db.transaction(async (tx) => {
              await tx.query(`select set_config('request.jwt.claims', $1, true), set_config('role', $2, true)`, [JSON.stringify(claims), claims.role]);
              return name.startsWith("rpc/") ? rpc(tx, req, name.slice(4), body) : rest(tx, req, name, url.searchParams, body);
            });
          } else throw httpError(404, "route");
        }
        send(out.status, out.body);
      } catch (e) {
        const status = e.status || (e.code === "42501" ? 403 : e.code === "23505" ? 409 : 400);
        if (!quiet && !e.status) console.error(`[dev-backend] ${req.method} ${url.pathname}: ${e.message}`);
        send(status, e.body || { message: e.message, code: e.code || null, details: e.detail || null, hint: e.hint || null });
      }
    }));
  });
  await new Promise((r) => server.listen(port, r));
  if (!quiet) console.log(`dev backend on http://localhost:${port} (anon key: dev-anon, service key: dev-service)`);
  return { db, server, files, mint, close: () => new Promise((r) => server.close(r)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { db, files } = await startBackend();
  const seed = new URL("dev-seed.mjs", import.meta.url);
  if (existsSync(seed)) await (await import(seed)).seed(db, files, `http://localhost:${PORT}`);
}
