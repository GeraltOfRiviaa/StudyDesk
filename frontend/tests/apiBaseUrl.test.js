import assert from "node:assert/strict"
import { test } from "node:test"
import { LOCAL_API_URL, normalizeApiBase } from "../src/api/baseUrl.js"

test("supports local Docker development and normalizes explicit API bases", () => {
    for (const value of [undefined, "", "   "]) {
        assert.equal(normalizeApiBase(value) || LOCAL_API_URL, "http://localhost:8000")
    }
    assert.equal(normalizeApiBase(" http://127.0.0.1:8000/ "), "http://127.0.0.1:8000")
    assert.equal(normalizeApiBase("https://fixture-8000.app.github.dev/"), "https://fixture-8000.app.github.dev")
    assert.equal(normalizeApiBase("/api/"), "/api")
})

test("rejects API bases that would make request routing ambiguous", () => {
    for (const value of ["/", "//host", "ftp://host", "missing-origin", "https://", "/api?mode=test", "https://user@host"]) {
        assert.throws(() => normalizeApiBase(value), /VITE_API_URL/)
    }
})
