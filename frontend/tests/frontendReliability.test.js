import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query"
import { createServer } from "vite"
import { bulkDeleteFeedback, bulkLinkFeedback, bulkTagFeedback } from "../src/lib/bulkFeedback.js"
import { refreshAccountQueries } from "../src/lib/accountQueries.js"

let server, tagSearchOptions, tagLookupOptions, bulkSetTags, syncItemLinks
let api, registerSessionVerification
before(async () => {
    server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: "custom" })
    const [search, lookup, bulk, links, client] = await Promise.all([
        server.ssrLoadModule("/src/hooks/useTagSearch.js"),
        server.ssrLoadModule("/src/hooks/useTagLookup.js"),
        server.ssrLoadModule("/src/api/bulkApi.js"),
        server.ssrLoadModule("/src/api/linkApi.js"),
        server.ssrLoadModule("/src/api/client.js"),
    ])
    tagSearchOptions = search.tagSearchOptions
    tagLookupOptions = lookup.tagLookupOptions
    bulkSetTags = bulk.bulkSetTags
    syncItemLinks = links.syncItemLinks
    api = client.api
    registerSessionVerification = client.registerSessionVerification
})
after(async () => server?.close())

const id = n => n.toString(16).padStart(24, "0")
const tag = n => ({ id: id(n), name: "Tag " + n, color: "#334455" })
const account = (userId = "owner") => ({ userId, signal: new AbortController().signal })
const params = url => new URL(url, "http://fixture").searchParams

test("shares paged picker search by account and term, including tags after the first 30", async t => {
    const session = account()
    const client = new QueryClient()
    const options = tagSearchOptions(session, "tag")
    const requests = []
    t.mock.method(globalThis, "fetch", async url => {
        const query = params(url)
        requests.push([query.get("q"), query.get("cursor"), query.get("sort"), query.get("order")])
        return Response.json(query.has("cursor")
            ? { items: [tag(31)], has_more: false, next_cursor: null }
            : { items: Array.from({ length: 30 }, (_, n) => tag(n + 1)), has_more: true, next_cursor: "next" })
    })
    const observer = new InfiniteQueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})
    t.after(() => { unsubscribe(); client.clear() })
    await observer.refetch({ cancelRefetch: false })
    const page = await observer.fetchNextPage()
    assert.equal(page.data.pages.flatMap(p => p.items).at(-1).id, id(31))
    assert.deepEqual(requests, [["tag", null, "name", "asc"], ["tag", "next", "name", "asc"]])
    assert.deepEqual(options.queryKey, tagSearchOptions(session, "tag").queryKey)
    assert.notDeepEqual(options.queryKey, tagSearchOptions(account("another"), "tag").queryKey)
})

test("detaches an unused search during debounce and ignores a late response", async t => {
    const client = new QueryClient()
    const session = account()
    let release, obsoleteSignal
    t.mock.method(globalThis, "fetch", async (url, options) => {
        if (params(url).get("q") === "old") {
            obsoleteSignal = options.signal
            return new Promise(resolve => { release = resolve })
        }
        return Response.json({ items: [tag(31)], has_more: false })
    })
    const obsolete = tagSearchOptions(session, "old")
    const observer = new InfiniteQueryObserver(client, obsolete)
    const unsubscribe = observer.subscribe(() => {})
    t.after(() => { unsubscribe(); client.clear() })
    assert.ok(release)
    observer.setOptions(tagSearchOptions(session, null))
    assert.equal(obsoleteSignal.aborted, true)
    observer.setOptions(tagSearchOptions(session, "new"))
    release(Response.json({ items: [tag(1)], has_more: false }))
    const visible = await observer.refetch({ cancelRefetch: false })
    assert.deepEqual(visible.data.pages[0].items, [tag(31)])
    assert.equal(client.getQueryData(obsolete.queryKey), undefined)
})

test("bounds lookup batches and reuses completed keys as item pages append", async t => {
    const session = account()
    const ids = Array.from({ length: 235 }, (_, index) => id(index + 10))
    const batches = tagLookupOptions(session, ids.slice(0, 180))
    const extended = tagLookupOptions(session, [...ids, ids[0].toUpperCase(), "invalid"])
    assert.deepEqual(extended[0].queryKey, batches[0].queryKey)
    assert.deepEqual(extended.map(option => option.queryKey.at(-1).length), [100, 100, 35])
    const received = []
    t.mock.method(globalThis, "fetch", async (_url, options) => {
        received.push(JSON.parse(options.body).ids.length)
        return Response.json([])
    })
    await Promise.all(extended.map(query => query.queryFn({ signal: new AbortController().signal })))
    assert.deepEqual(received, [100, 100, 35])
})

test("reports acknowledged counts for no-op, mixed, and complete bulk operations", () => {
    assert.deepEqual(bulkTagFeedback({ matched: 4, modified: 0 }, "added"), {
        title: "No tags added", description: "0 of 4 matched items changed.", type: "info",
    })
    assert.equal(bulkTagFeedback({ matched: 4, modified: 2 }, "cleared").description, "2 of 4 matched items changed.")
    assert.equal(bulkTagFeedback({ matched: 4, modified: 2 }, "cleared").type, "info")
    assert.equal(bulkTagFeedback({ matched: 4, modified: 4 }, "added").type, "success")
    assert.equal(bulkLinkFeedback({ deleted: 0 }).type, "info")
    assert.equal(bulkDeleteFeedback({ deleted: 0, skipped: 2 }).type, "info")
    assert.equal(bulkDeleteFeedback({ deleted: 1, skipped: 2 }).type, "info")
    assert.equal(bulkDeleteFeedback({ deleted: 2, skipped: 0 }).type, "success")
})

test("a retired session can neither dispatch the next bulk batch nor invalidate another account", async t => {
    const controller = new AbortController()
    const session = { userId: "owner", signal: controller.signal }
    const invalidated = []
    const client = { invalidateQueries: ({ queryKey }) => invalidated.push(queryKey) }
    await refreshAccountQueries(client, session)
    assert.deepEqual(invalidated, [["library", "owner"], ["tags", "owner"]])
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        controller.abort()
        return Response.json({ matched: 100, modified: 2 })
    })
    const items = Array.from({ length: 101 }, (_, index) => ({ type: "note", id: id(index) }))
    await assert.rejects(bulkSetTags({ items, tags: [id(99)], signal: session.signal }), { name: "AbortError" })
    assert.equal(fetch.mock.callCount(), 1)
    await refreshAccountQueries(client, session)
    assert.equal(invalidated.length, 2)
})

test("closing a modal can stop follow-ups while allowing its dispatched link write to settle", async t => {
    const modal = new AbortController()
    const session = new AbortController()
    const fetch = t.mock.method(globalThis, "fetch", async (_url, options) => {
        if (options.method === "GET") return Response.json([])
        assert.equal(options.signal, session.signal)
        modal.abort()
        return Response.json({ ok: true }, { status: 201 })
    })
    await assert.rejects(syncItemLinks("note", id(1), [
        { item_type: "note", item_id: id(3) }, { item_type: "note", item_id: id(4) },
    ], { signal: modal.signal, writeSignal: session.signal }), { name: "AbortError" })
    assert.equal(fetch.mock.callCount(), 2)
    assert.equal(session.signal.aborted, false)
})

test("protected 401 waits for verification and returns the original response without replaying a write", async t => {
    let release, captured
    const scope = {}
    const remove = registerSessionVerification({
        capture: () => scope,
        verify: snapshot => {
            captured = snapshot
            return new Promise(resolve => { release = resolve })
        },
    })
    t.after(remove)
    const response = Response.json({ detail: "Operation was rejected" }, { status: 401 })
    const fetch = t.mock.method(globalThis, "fetch", async () => response)
    let rejected = false
    const result = assert.rejects(api("/notes/123", { method: "PATCH", json: { title: "Changes" } }), error => {
        rejected = true
        return error === response
    })
    await Promise.resolve()
    assert.equal(captured, scope)
    assert.equal(rejected, false)
    release()
    await result
    assert.deepEqual(await response.json(), { detail: "Operation was rejected" })
    assert.equal(fetch.mock.callCount(), 1)
})

test("auth control requests and unrelated API failures bypass verification", async t => {
    let checks = 0
    t.after(registerSessionVerification({ capture: () => ({}), verify: () => { checks += 1 } }))
    const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }))
    for (const route of ["/auth/login", "/auth/register", "/auth/logout", "/auth/user/?fixture=1"]) {
        await assert.rejects(api(route), { status: 401 })
    }
    for (const status of [403, 429, 503]) {
        fetch.mock.mockImplementation(async () => new Response(null, { status }))
        await assert.rejects(api("/notes/123"), { status })
    }
    fetch.mock.mockImplementation(async () => { throw new TypeError("Network unavailable") })
    await assert.rejects(api("/notes/123"), TypeError)
    assert.equal(checks, 0)
})

test("a disposed registration ignores late responses and cannot remove its replacement", async t => {
    let oldChecks = 0
    let newChecks = 0
    let deliver
    const response = new Response(null, { status: 401 })
    const fetch = t.mock.method(globalThis, "fetch", () => new Promise(resolve => { deliver = resolve }))
    const disposeOld = registerSessionVerification({ capture: () => ({}), verify: () => { oldChecks += 1 } })
    const pending = assert.rejects(api("/notes/123"), error => error === response)
    const disposeNew = registerSessionVerification({
        capture: () => ({}),
        verify: () => {
            newChecks += 1
            throw new Error("Verification callback failed")
        },
    })
    t.after(disposeNew)
    disposeOld()
    deliver(response)
    await pending

    fetch.mock.mockImplementation(async () => response)
    await assert.rejects(api("/notes/123"), error => error === response)
    assert.equal(oldChecks, 0)
    assert.equal(newChecks, 1)
    disposeNew()
    await assert.rejects(api("/notes/123"), error => error === response)
    assert.equal(newChecks, 1)
})
