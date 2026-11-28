import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { setTimeout as sleep } from "node:timers/promises"
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query"
import { createServer } from "vite"

let server
let libraryPageOptions
let hasUnusableContinuation
let normalizeLibrarySort

before(async () => {
    server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: "custom" })
    const library = await server.ssrLoadModule("/src/hooks/useLibrary.js")
    const filters = await server.ssrLoadModule("/src/hooks/useLibraryFilters.js")
    libraryPageOptions = library.libraryPageOptions
    hasUnusableContinuation = library.hasUnusableContinuation
    normalizeLibrarySort = filters.normalizeLibrarySort
})
after(async () => server?.close())

function setup(t, fetchPage) {
    const client = new QueryClient()
    const options = (filters, revision) => ({
        ...libraryPageOptions(["library", "owner", filters, revision], fetchPage, filters, true),
        retryDelay: 0,
    })
    const observer = new InfiniteQueryObserver(client, options({ q: "alpha" }, 1))
    const unsubscribe = observer.subscribe(() => {})
    t.after(() => {
        unsubscribe()
        client.clear()
    })
    return { client, observer, options }
}

function page(id, nextCursor = null, hasMore = !!nextCursor) {
    return { items: [{ id, type: "note" }], next_cursor: nextCursor, has_more: hasMore }
}

async function load(observer) {
    return observer.refetch({ cancelRefetch: false })
}

test("normalizes saved tag sorting without losing URL filters", () => {
    const old = new URLSearchParams("q=biology&sort=tags&order=asc&tags=a&tags=b")
    const updated = normalizeLibrarySort(old)
    assert.equal(updated.toString(), "q=biology&sort=updated_at&order=asc&tags=a&tags=b")
    assert.equal(old.get("sort"), "tags")
    assert.equal(normalizeLibrarySort(updated), updated)
})

test("starts with a null cursor on filter changes and revisits, and collects obsolete revisions", async t => {
    const requests = []
    const { client, observer, options } = setup(t, async ({ q, cursor }) => {
        requests.push({ q, cursor })
        return cursor ? page(`${q}-2`) : page(`${q}-1`, `${q}-next`)
    })
    await load(observer)
    await observer.fetchNextPage()
    observer.setOptions(options({ q: "beta" }, 2))
    await load(observer)
    observer.setOptions(options({ q: "alpha" }, 3))
    await load(observer)
    assert.deepEqual(requests, [
        { q: "alpha", cursor: null }, { q: "alpha", cursor: "alpha-next" },
        { q: "beta", cursor: null }, { q: "alpha", cursor: null },
    ])
    await sleep(20)
    const cached = client.getQueryCache().findAll({ queryKey: ["library", "owner"] })
    assert.equal(cached.length, 1)
    assert.deepEqual(cached[0].queryKey, options({ q: "alpha" }, 3).queryKey)
    await client.invalidateQueries({ queryKey: ["library", "owner"], refetchType: "none" })
    assert.equal(cached[0].state.isInvalidated, true)
})

test("preserves loaded rows after a cursor 422 and reloads from the beginning", async t => {
    const requests = []
    const { observer, options } = setup(t, async ({ q, cursor }) => {
        requests.push({ q, cursor })
        if (cursor) throw Response.json({ detail: "Invalid cursor" }, { status: 422 })
        return page(q, "stale")
    })
    await load(observer)
    const interrupted = await observer.fetchNextPage()
    assert.equal(hasUnusableContinuation(interrupted), true)
    assert.deepEqual(interrupted.data.pages, [page("alpha", "stale")])
    assert.deepEqual(requests.map(request => request.cursor), [null, "stale"])

    observer.setOptions(options({ q: "alpha" }, 2))
    const reloaded = await load(observer)
    assert.equal(hasUnusableContinuation(reloaded), false)
    assert.deepEqual(reloaded.data.pageParams, [null])
    assert.deepEqual(requests.at(-1), { q: "alpha", cursor: null })
})

test("detects missing and repeated continuation tokens", async t => {
    const { observer } = setup(t, async ({ cursor }) => cursor ? page("second", "repeat") : page("first", "repeat"))
    await load(observer)
    const result = await observer.fetchNextPage()
    assert.equal(result.hasNextPage, false)
    assert.equal(hasUnusableContinuation(result), true)
    assert.equal(hasUnusableContinuation({ data: { pages: [page("first", null, true)] }, hasNextPage: false }), true)
})

test("retains the retry budget for a transient page request failure", async t => {
    let attempts = 0
    const { observer } = setup(t, async ({ cursor }) => {
        if (!cursor) return page("first", "next")
        if (++attempts <= 2) throw new Response(null, { status: 503 })
        return page("second")
    })
    await load(observer)
    const error = await observer.fetchNextPage()
    assert.equal(error.isFetchNextPageError, true)
    assert.equal(hasUnusableContinuation(error), false)
    assert.equal(attempts, 2)
    const recovered = await observer.fetchNextPage()
    assert.equal(recovered.isSuccess, true)
    assert.equal(recovered.data.pages.length, 2)
})
