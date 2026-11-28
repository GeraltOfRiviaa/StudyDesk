import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let bulk
before(async () => {
    server = await createServer({ server: { middlewareMode: true, watch: null }, appType: "custom" })
    bulk = await server.ssrLoadModule("/src/api/bulkApi.js")
})
after(async () => server?.close())

const target = (index, type = "note") => ({ type, id: index.toString(16).padStart(24, "0") })
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
})

test("uses typed IDs for completed targets across successful and partially acknowledged batches", async t => {
    const sharedId = target(250, "note").id
    const items = [
        ...Array.from({ length: 100 }, (_, index) => target(index)),
        { id: sharedId, type: "note" },
        target(251, "event"),
        { id: sharedId, type: "event" },
    ]
    const calls = []
    t.mock.method(globalThis, "fetch", async (_url, options) => {
        calls.push(JSON.parse(options.body))
        if (calls.length === 1) return jsonResponse({ matched: 100, modified: 12 })
        if (calls.length === 2) return jsonResponse({
            detail: {
                message: "Interrupted",
                completed_items: [{ id: sharedId.toUpperCase(), type: "event" }, target(499)],
                matched: 1,
                modified: 0,
            },
        }, 503)
        return jsonResponse({ matched: 2, modified: 1 })
    })
    const tags = [target(12).id]
    let unfinished
    await assert.rejects(() => bulk.bulkSetTags({ items, tags }), error => {
        assert.deepEqual(error.completedItems, [...items.slice(0, 100), items.at(-1)])
        assert.equal(error.matched, 101)
        assert.equal(error.modified, 12)
        assert.match(bulk.bulkErrorDescription(error, items.length, "modified", "modifications"), /101 of 103 targets completed. 12 modifications confirmed/)
        const completed = new Set(error.completedItems.map(bulk.bulkTargetKey))
        unfinished = items.filter(item => !completed.has(bulk.bulkTargetKey(item)))
        return true
    })
    await bulk.bulkSetTags({ items: unfinished, tags })
    assert.deepEqual(calls.map(call => call.items.length), [100, 3, 2])
    assert.deepEqual(calls.at(-1), { items: items.slice(100, 102), tags })
})

test("keeps targets in an unacknowledged batch eligible for retry", async t => {
    const items = Array.from({ length: 101 }, (_, index) => target(index))
    let request = 0
    t.mock.method(globalThis, "fetch", async () => {
        if (++request === 1) return jsonResponse({ deleted: 80, skipped: 20 })
        throw new TypeError("Connection lost")
    })
    await assert.rejects(() => bulk.bulkDeleteItems({ items }), error => {
        assert.deepEqual(error.completedItems, items.slice(0, 100))
        assert.equal(error.deleted, 80)
        return true
    })
})

test("reconciles per-tag deletion results by ID and separates no-ops from deletions", async t => {
    const items = [1, 2, 3, 4].map(index => target(index, "tag"))
    t.mock.method(globalThis, "fetch", async url => {
        const id = new URL(url, "http://test").searchParams.get("ids")
        if (id === items[0].id) return jsonResponse({ deleted: 1 })
        if (id === items[1].id) return jsonResponse({ detail: { message: "Try again" } }, 503)
        if (id === items[2].id) return jsonResponse({ deleted: 0 })
        return jsonResponse({ detail: "Tag not found" }, 404)
    })
    await assert.rejects(() => bulk.bulkDeleteTags(items), error => {
        assert.deepEqual(error.completedItems, [items[0], items[2], items[3]])
        assert.equal(error.deleted, 1)
        return true
    })
})
