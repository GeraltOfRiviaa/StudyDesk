import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { test } from "node:test"
import { setTimeout as sleep } from "node:timers/promises"
import { createServer } from "vite"

const executable = process.env.STUDYDESK_TEST_CHROME
const stamp = "2026-01-01T00:00:00Z"
const id = number => number.toString(16).padStart(24, "0")

function makeFixture() {
    const fixture = {
        owner: "alice", authStatus: 503, loginStatus: 200,
        requests: [], details: [], creation: null, probes: new Map(), heldChecks: [],
    }
    const namedTag = (number, name) => ({ id: id(number), name, color: "#345678", created_at: stamp, updated_at: stamp })
    fixture.tags = [
        namedTag(1, "Twin"), namedTag(2, "Twin"),
        ...Array.from({ length: 30 }, (_, index) => namedTag(index + 3, "Topic " + index)),
        namedTag(33, "Late tag"),
    ]
    const note = owner => ({
        id: id(owner === "alice" ? 1000 : 1001), type: "note",
        title: owner + " note", content: owner + " private content", tags: [],
        created_at: stamp, updated_at: stamp,
    })

    fixture.middleware = (req, res, next) => {
        const url = new URL(req.url, "http://fixture")
        if (!url.pathname.startsWith("/fixture-api/")) return next()
        const route = url.pathname.slice("/fixture-api".length)
        fixture.requests.push({ route, cursor: url.searchParams.get("cursor"), owner: fixture.owner, method: req.method })
        function send(data, status = 200) {
            if (res.destroyed) return
            res.writeHead(status, { "Content-Type": "application/json" })
            res.end(JSON.stringify(data))
        }
        if (route === "/auth/user") {
            const { authStatus, owner } = fixture
            const result = authStatus === 200
                ? { id: id(owner === "alice" ? 901 : 902), username: owner, email: owner + "@example.com", created_at: stamp }
                : { detail: "Fixture status" }
            if (!fixture.holdChecks) return send(result, authStatus)
            const check = { closed: false, release: () => send(result, authStatus) }
            res.on("close", () => { check.closed = true })
            fixture.heldChecks.push(check)
            return
        }
        if (route === "/auth/logout") {
            fixture.authStatus = 401
            return send({ ok: true })
        }
        if (route === "/auth/login") {
            if (fixture.loginStatus === 401) return send({ detail: "Invalid credentials" }, 401)
            fixture.authStatus = 503
            return send({ ok: true })
        }
        if (route === "/auth/me" && req.method === "DELETE") {
            fixture.authStatus = 401
            return send(null, 204)
        }
        if (route === "/library") return send({ items: [note(fixture.owner)], has_more: false })
        if (route.startsWith("/fixture-protected/")) {
            const name = route.split("/").at(-1)
            fixture.probes.set(name, () => send({ detail: name }, 401))
            return
        }
        if (route === "/tags/library") {
            const term = (url.searchParams.get("q") ?? "").toLowerCase()
            const matches = fixture.tags.filter(tag => tag.name.toLowerCase().includes(term))
            const offset = Number(url.searchParams.get("cursor") ?? 0)
            const hasMore = matches.length > offset + 30
            return send({ items: matches.slice(offset, offset + 30), has_more: hasMore, next_cursor: hasMore ? String(offset + 30) : null })
        }
        if (route === "/tags/lookup" || route === "/tags/") {
            let body = ""
            req.on("data", data => { body += data })
            req.on("end", () => {
                const input = JSON.parse(body)
                if (route === "/tags/lookup") return send(fixture.tags.filter(tag => input.ids.includes(tag.id)))
                const created = namedTag(34, input.name)
                // Simulate a committed write whose response arrives after the parent form closes.
                fixture.tags.push(created)
                fixture.creation = () => send(created, 201)
            })
            return
        }
        if (route.startsWith("/notes/")) {
            if (req.method === "PATCH") return send({ detail: "Note update rejected" }, 401)
            const item = note(fixture.owner)
            const request = { closed: false, release: () => send(item) }
            res.on("close", () => { request.closed = true })
            fixture.details.push(request)
            return
        }
        if (route === "/links/items") return send([{ id: id(1002), title: "Fixture link", type: "note" }])
        if (route.startsWith("/links/")) return send([])
        return send({ detail: "Unknown fixture path" }, 404)
    }
    return fixture
}

function sessionBridge() {
    const name = "virtual:reliability-session-bridge"
    return {
        name: "reliability-session-bridge",
        enforce: "pre",
        resolveId(id) { if (id === name) return "\0" + name },
        load(id) {
            if (id !== "\0" + name) return
            return `
                import { useEffect } from "react"
                import { useUser } from "@/context/AuthContext"
                import { api } from "@/api/client"
                export function SessionBridge() {
                    const { refreshUser, logout } = useUser()
                    useEffect(() => { window.reliabilitySession = { refreshUser, logout, api } }, [refreshUser, logout])
                    return null
                }
            `
        },
        transform(source, id) {
            if (!id.replaceAll("\\", "/").endsWith("/src/main.jsx")) return
            return `import { SessionBridge } from "${name}"\n` + source
                .replace("<App />", "<App /><SessionBridge />")
                .replace("createRoot(document.getElementById('root')).render(",
                    "const fixtureRoot = createRoot(document.getElementById('root')); window.unmountReliabilityApp = () => fixtureRoot.unmount(); fixtureRoot.render(")
        },
    }
}

async function waitFor(check, label) {
    const deadline = Date.now() + 15_000
    let lastError
    while (Date.now() < deadline) {
        try {
            const result = await check()
            if (result) return result
        } catch (error) {
            lastError = error
        }
        await sleep(60)
    }
    throw new Error("Timed out waiting for " + label, { cause: lastError })
}

async function openChrome(profile) {
    const child = spawn(executable, [
        "--headless=new", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1",
        "--disable-gpu", "--disable-background-networking", "--disable-component-update",
        "--no-first-run", "--no-default-browser-check", "--window-size=1000,800",
        "--user-data-dir=" + profile, "about:blank",
    ], { stdio: "ignore", windowsHide: true })
    let launchError
    child.on("error", error => { launchError = error })
    let socket
    async function close() {
        socket?.close()
        if (child.pid && child.exitCode === null && child.signalCode === null) {
            const exited = once(child, "exit")
            child.kill()
            await Promise.race([exited, sleep(1500)])
        }
    }
    try {
        const port = await waitFor(async () => {
            if (launchError) throw launchError
            return (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]
        }, "browser debugging port")
        const pages = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json()
        socket = new WebSocket(pages.find(page => page.type === "page").webSocketDebuggerUrl)
        await once(socket, "open")
        const pending = new Map()
        let sequence = 0
        socket.addEventListener("message", event => {
            const { result, error, id } = JSON.parse(event.data)
            const request = pending.get(id)
            if (!request) return
            pending.delete(id)
            if (error) request.reject(new Error(error.message))
            else request.resolve(result)
        })
        const command = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++sequence
            pending.set(id, { resolve, reject })
            socket.send(JSON.stringify({ id, method, params }))
        })
        async function evaluate(fn, ...args) {
            const expression = `(${fn})(...${JSON.stringify(args)})`
            const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
            if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description)
            return result.result.value
        }
        return { command, evaluate, close }
    } catch (error) {
        await close()
        throw error
    }
}

test("shared pickers, modal cancellation, and authentication transitions in Chrome", {
    skip: executable ? false : "Set STUDYDESK_TEST_CHROME to a Chromium executable",
    timeout: 65_000,
}, async () => {
    const fixture = makeFixture()
    const profile = await mkdtemp(path.join(os.tmpdir(), "studydesk-reliability-chrome-"))
    const server = await createServer({
        cacheDir: path.join(profile, "vite-cache"),
        define: { "import.meta.env.VITE_API_URL": JSON.stringify("/fixture-api") },
        plugins: [sessionBridge(), {
            name: "reliability-fixture-api",
            configureServer(vite) { vite.middlewares.use(fixture.middleware) },
        }],
        server: { host: "127.0.0.1", port: 0, ws: false, watch: null },
    })
    let browser
    try {
        await server.listen()
        browser = await openChrome(profile)
        const { evaluate, command } = browser
        const heading = text => evaluate(text => !![...document.querySelectorAll("h1")].find(el => el.textContent === text), text)
        const click = selector => waitFor(() => evaluate(selector => {
            const el = document.querySelector(selector)
            if (!el || el.disabled) return false
            el.click()
            return true
        }, selector), selector)
        const text = (selector, value, act = false) => evaluate((selector, value, act) => {
            const el = [...document.querySelectorAll(selector)].find(element => element.textContent.trim() === value)
            if (!el || el.disabled) return false
            if (act) el.click()
            return true
        }, selector, value, act)
        const clickText = (selector, value) => waitFor(() => text(selector, value, true), value)
        const input = (selector, value) => evaluate((selector, value) => {
            const el = document.querySelector(selector)
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value)
            el.dispatchEvent(new Event("input", { bubbles: true }))
        }, selector, value)
        const dialogs = () => evaluate(() => document.querySelectorAll('[data-slot="dialog-content"]').length)
        const search = '[role=dialog] [aria-label="Search tags"]'
        const options = '[role=dialog] [role=option]'
        const openFilter = async () => {
            await click('[aria-label="Filters"]')
            await waitFor(() => evaluate(() => {
                const entry = [...document.querySelectorAll("[role=menuitem]")].find(el => /^Tags \(\d+\)$/.test(el.textContent))
                if (!entry) return false
                entry.click()
                return true
            }), "Tags filter option")
            await waitFor(dialogs, "tag filter dialog")
        }
        const close = async () => {
            await click('[role=dialog] [data-slot="dialog-close"]')
            await waitFor(async () => !(await dialogs()), "closed filter dialog")
        }
        const authChecks = () => fixture.requests.filter(request => request.route === "/auth/user").length
        const startProbe = async name => {
            await evaluate(name => {
                window.reliabilityProbes ??= {}
                void window.reliabilitySession.api("/fixture-protected/" + name).catch(async response => {
                    window.reliabilityProbes[name] = { status: response.status, detail: (await response.json()).detail }
                })
            }, name)
            await waitFor(() => fixture.probes.has(name), "protected request " + name)
        }
        const assertProbe = async name => {
            const result = await waitFor(() => evaluate(name => window.reliabilityProbes[name], name), "protected response " + name)
            assert.deepEqual(result, { status: 401, detail: name })
        }

        const libraryUrl = "http://127.0.0.1:" + server.httpServer.address().port + "/library"
        await command("Page.navigate", { url: libraryUrl })
        await waitFor(() => text("[role=alert]", "Could not verify your session."), "transient initial failure")
        assert.equal(await evaluate(() => location.pathname), "/library")
        fixture.authStatus = 200
        await clickText("button", "Retry")
        await waitFor(() => heading("Library"), "verified Library")

        await openFilter()
        await waitFor(() => evaluate(selector => document.querySelectorAll(selector).length === 30, options), "immediate suggestions")
        const transparent = "rgba(0, 0, 0, 0)"
        const backgrounds = () => evaluate(selector => [...document.querySelectorAll(selector)].map(el => ({
            selected: el.dataset.selected === "true",
            color: getComputedStyle(el).backgroundColor,
        })), options)
        assert.ok((await backgrounds()).every(row => row.color === transparent))
        assert.equal(await evaluate(selector => getComputedStyle(document.querySelector(selector)
            .closest("[cmdk-group]")).borderTopWidth, options), "1px")

        await clickText("button", "Load more")
        await waitFor(() => text(options, "Late tag"), "late tag suggestion")
        const point = await evaluate(selector => {
            const row = [...document.querySelectorAll(selector)].find(el => el.textContent.trim() === "Late tag")
            row.scrollIntoView({ block: "nearest" })
            const { x, y, width, height } = row.getBoundingClientRect()
            return { x: x + width / 2, y: y + height / 2 }
        }, options)
        await command("Input.dispatchMouseEvent", { type: "mouseMoved", ...point })
        await waitFor(async () => (await backgrounds()).at(-1).color !== transparent, "hover highlight")
        assert.equal((await backgrounds()).filter(row => row.color !== transparent).length, 1)
        await command("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point })
        await command("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point })
        await waitFor(() => evaluate(id => new URLSearchParams(location.search).get("tags") === id, id(33)), "immediate URL filter")
        await input(search, "Twin")
        await waitFor(() => evaluate(selector => [...document.querySelectorAll(selector)].map(el => el.textContent.trim())
            .filter(label => label.startsWith("Twin") && label.includes("·")).length === 2, options), "duplicate labels")
        assert.equal(await evaluate(() => !!document.querySelector('[aria-label^="Remove Late tag"]')), true)
        assert.equal(await evaluate(selector => [...document.querySelectorAll(selector)].some(el => el.textContent.includes("Create")), options), false)
        await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 })
        await evaluate(selector => document.querySelector(selector).focus(), search)
        await command("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 })
        await waitFor(async () => (await backgrounds()).some(row => row.selected && row.color !== transparent), "keyboard highlight")
        assert.equal((await backgrounds()).filter(row => row.color !== transparent).length, 1)
        await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 })
        await waitFor(() => evaluate(() => new URLSearchParams(location.search).getAll("tags").length === 2), "keyboard selection")
        await close()

        await click('[aria-label="Add item"]')
        await clickText("[role=menuitem]", "Note")
        await waitFor(dialogs, "note creation modal")
        const linkSearch = '[role=dialog] [placeholder="Search items to link..."]'
        await input(linkSearch, "Fixture")
        await waitFor(() => evaluate(() => {
            const option = [...document.querySelectorAll("[role=option]")].find(el => el.textContent.includes("Fixture link"))
            if (!option) return false
            option.click()
            return true
        }), "link selection")
        assert.equal(await evaluate(selector => document.querySelector(selector).value, linkSearch), "")
        await input(search, "Fresh tag")
        await clickText(options, "Create “Fresh tag”")
        await waitFor(() => fixture.creation, "dispatched inline tag write")
        await clickText('[role=dialog] button', "Cancel")
        await waitFor(async () => !(await dialogs()), "canceled note form")
        fixture.creation()
        await openFilter()
        await input(search, "Fresh tag")
        await waitFor(() => text(options, "Fresh tag"), "tag creation survived modal closure")
        await close()

        await clickText("button", "alice note")
        await waitFor(() => fixture.details.length === 1, "pending private detail")
        fixture.authStatus = 503
        assert.equal(await evaluate(() => window.reliabilitySession.refreshUser()), "unavailable")
        assert.equal(await dialogs(), 1)
        fixture.authStatus = 200
        assert.equal(await evaluate(() => window.reliabilitySession.refreshUser()), "verified")
        assert.equal(await dialogs(), 1)
        assert.equal(fixture.details.length, 1)

        fixture.authStatus = 503
        fixture.holdChecks = true
        for (const name of ["first", "concurrent", "staggered"]) await startProbe(name)
        const checksBefore = authChecks()
        fixture.probes.get("first")()
        await waitFor(() => fixture.heldChecks.length === 1, "verification after protected 401")
        fixture.probes.get("concurrent")()
        // An explicit refresh shares the pending check instead of canceling it.
        await evaluate(() => { window.pendingRefresh = window.reliabilitySession.refreshUser() })
        assert.equal(authChecks(), checksBefore + 1)
        fixture.heldChecks[0].release()
        assert.equal(await evaluate(() => window.pendingRefresh), "unavailable")
        for (const name of ["first", "concurrent"]) await assertProbe(name)
        fixture.probes.get("staggered")()
        await assertProbe("staggered")
        assert.equal(authChecks(), checksBefore + 1)
        assert.equal(await dialogs(), 1)
        assert.equal(await heading("Library"), true)

        await startProbe("old-account")
        fixture.holdChecks = false
        fixture.authStatus = 200
        fixture.owner = "bob"
        assert.equal(await evaluate(() => window.reliabilitySession.refreshUser()), "verified")
        await waitFor(() => text("button", "bob note"), "new account Library")
        await waitFor(() => fixture.details[0].closed, "old account detail aborted")
        fixture.details[0].release()
        assert.equal(await dialogs(), 0)
        assert.equal(await text("button", "alice note"), false)
        const checksInNewSession = authChecks()
        fixture.probes.get("old-account")()
        await assertProbe("old-account")
        assert.equal(authChecks(), checksInNewSession)

        await clickText("button", "bob note")
        await waitFor(() => fixture.details.length === 2, "note detail for save")
        fixture.details[1].release()
        await click('[role=dialog] [role=switch]')
        await input("#edit-note-title", "Edited note")
        await clickText("[role=dialog] button", "Save changes")
        await waitFor(() => text('[data-slot="toast-title"]', "Could not confirm note update"), "operation error for verified session")
        assert.equal(authChecks(), checksInNewSession + 1)
        assert.equal(await dialogs(), 1)

        fixture.authStatus = 401
        await clickText("[role=dialog] button", "Save changes")
        await waitFor(() => heading("Login"), "confirmed expiration after save")
        assert.equal(authChecks(), checksInNewSession + 2)
        assert.equal(await dialogs(), 0)
        await waitFor(async () => !(await text('[data-slot="toast-title"]', "Could not confirm note update")), "obsolete toast cleared")
        assert.equal(fixture.requests.filter(request => request.route.startsWith("/notes/") && request.method === "PATCH").length, 2)

        fixture.loginStatus = 401
        await input('input[name="username"]', "bob")
        await input('input[name="password"]', "fixture-password")
        await clickText("button", "Login")
        await waitFor(() => text('[data-slot="toast-description"]', "Wrong password or username"), "invalid sign-in feedback")
        assert.equal(authChecks(), checksInNewSession + 2)
        fixture.loginStatus = 200
        await clickText("button", "Login")
        await waitFor(() => text("[role=alert]", "Signed in, but your session could not be verified."), "post-login verification retry")
        fixture.authStatus = 200
        await clickText("button", "Retry verification")
        await waitFor(() => evaluate(() => location.pathname === "/"), "verified sign-in")
        assert.equal(fixture.requests.filter(request => request.route === "/auth/login").length, 2)
        await command("Page.navigate", { url: libraryUrl })
        await clickText("button", "bob note")
        await waitFor(() => fixture.details.length === 3, "pending detail before logout")
        await evaluate(() => window.reliabilitySession.logout())
        await waitFor(() => heading("Login"), "signed-out route")
        await waitFor(() => fixture.details[2].closed, "detail aborted on logout")
        fixture.details[2].release()
        assert.equal(await dialogs(), 0)

        fixture.authStatus = 200
        await command("Page.navigate", { url: new URL("/settings", libraryUrl).href })
        await clickText("button", "Delete account")
        await waitFor(dialogs, "account deletion dialog")
        await input("#delete-account-password", "fixture-password")
        await clickText("[role=dialog] button[type=submit]", "Delete account")
        await waitFor(() => text("[role=status]", "Account deleted."), "account deletion redirect")
        assert.equal(await dialogs(), 0)

        fixture.authStatus = 200
        await command("Page.navigate", { url: libraryUrl })
        await waitFor(() => heading("Library"), "verified Library before unmount")
        fixture.holdChecks = true
        await startProbe("unmount")
        fixture.probes.get("unmount")()
        await waitFor(() => fixture.heldChecks.length === 2, "verification before unmount")
        await evaluate(() => window.unmountReliabilityApp())
        await waitFor(() => fixture.heldChecks[1].closed, "verification aborted on unmount")
        await assertProbe("unmount")
        const checksAfterUnmount = authChecks()
        await startProbe("disposed")
        fixture.probes.get("disposed")()
        await assertProbe("disposed")
        assert.equal(authChecks(), checksAfterUnmount)
    } finally {
        await browser?.close()
        await server.close()
        const resolved = await realpath(profile)
        const temporaryRoot = await realpath(os.tmpdir())
        if (path.dirname(resolved) === temporaryRoot && path.basename(resolved).startsWith("studydesk-reliability-chrome-")) {
            await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => {})
        }
    }
})
