import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let syncItemLinks
let identityConflictMessage
before(async () => {
    server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: "custom" })
    const linkApi = await server.ssrLoadModule("/src/api/linkApi.js")
    const accountApi = await server.ssrLoadModule("/src/api/accountApi.js")
    syncItemLinks = linkApi.syncItemLinks
    identityConflictMessage = accountApi.identityConflictMessage
})
after(async () => server?.close())

const source = "000000000000000000000001"
const selected = { item_type: "note", item_id: "abcdefabcdefabcdefabcdef" }
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
})

test("reconciles a duplicate link only after confirming its typed ID", async t => {
    const deselected = { item_type: "note", item_id: "000000000000000000000002", link_id: "link" }
    let reads = 0
    const calls = t.mock.method(globalThis, "fetch", async (_url, { method }) => {
        if (method === "POST") return jsonResponse({ detail: "Items are already linked" }, 409)
        if (method === "DELETE") return jsonResponse({ deleted: 1 })
        return jsonResponse(++reads === 1 ? [deselected] : [selected, deselected])
    })
    await syncItemLinks("note", source, [{ ...selected, item_id: selected.item_id.toUpperCase() }])
    assert.deepEqual(calls.mock.calls.map(call => call.arguments[1].method), ["GET", "POST", "GET", "DELETE"])
})

test("same ID on a different item type doesn't confirm a duplicate link", async t => {
    const conflict = jsonResponse({ detail: "Items are already linked" }, 409)
    let reads = 0
    const calls = t.mock.method(globalThis, "fetch", async (_url, { method }) => {
        if (method === "POST") return conflict
        return jsonResponse(++reads === 1 ? [] : [{ ...selected, item_type: "file" }])
    })
    await assert.rejects(syncItemLinks("note", source, [selected]), error => error === conflict)
    assert.equal(calls.mock.callCount(), 3)
})

test("propagates an unrelated uniqueness conflict without retrying", async t => {
    const conflict = jsonResponse({ detail: "Link conflicts with an existing record" }, 409)
    const calls = t.mock.method(globalThis, "fetch", async (_url, { method }) => {
        return method === "POST" ? conflict : jsonResponse([])
    })
    await assert.rejects(syncItemLinks("note", source, [selected]), error => error === conflict)
    assert.equal(calls.mock.callCount(), 2)
})

test("preserves separate username and email conflict messages", async () => {
    for (const detail of ["Username already in use", "Email already in use"]) {
        assert.equal(await identityConflictMessage(jsonResponse({ detail }, 409)), detail)
    }
    assert.equal(await identityConflictMessage(jsonResponse({}, 429)), null)
})
