import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { glob, readFile } from "node:fs/promises";
import { get } from "node:http";
import { Readable } from "node:stream";
import { test } from "node:test";
import Stripe from "stripe";
import { createTestHarness } from "wrangler";

test("the Worker delivers only paid orders for the book", async (t) => {
    const paymentLink = "plink_sacredStruggle";
    const webhookSecret = randomUUID();
    const stripe = new Stripe("test-read-key");
    const book = "local EPUB fixture";
    const paid = {
        id: "cs_test_paidBookOrder",
        mode: "payment",
        payment_link: paymentLink,
        payment_status: "paid",
        customer_details: { email: "reader@example.com" },
    };
    const pending = { ...paid, id: "cs_test_pendingBookOrder", payment_status: "unpaid" };
    const other = { ...paid, id: "cs_test_otherOrder", payment_link: "plink_other" };
    const orders = new Map([paid, pending, other].map((order) => [order.id, order]));
    const realFetch = globalThis.fetch;
    let stripeLookups = 0;
    t.mock.method(globalThis, "fetch", (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.hostname !== "api.stripe.com") return realFetch(input, init);
        stripeLookups += 1;
        const order = orders.get(url.pathname.split("/").at(-1));
        return order
            ? Response.json(order)
            : Response.json({ error: { type: "invalid_request_error", code: "resource_missing" } }, { status: 404 });
    });

    const server = createTestHarness({
        workers: [{
            configPath: "./wrangler.jsonc",
            vars: { STRIPE_EBOOK_PAYMENT_LINK: paymentLink },
            secrets: { STRIPE_EBOOK_READ_KEY: "test-read-key", STRIPE_EBOOK_WEBHOOK_SECRET: webhookSecret },
        }],
    });
    t.after(() => server.close());
    const address = await server.listen();
    const worker = server.getWorker();
    const env = await worker.getEnv();
    const url = (route, id) => `/sacred-struggle/${route}?session_id=${id}`;
    const webhook = (order, eventType = "checkout.session.completed", secret = webhookSecret) => {
        const payload = JSON.stringify({ type: eventType, data: { object: order } });
        return server.fetch("/api/sacred-struggle/stripe", {
            method: "POST",
            headers: { "Stripe-Signature": stripe.webhooks.generateTestHeaderString({ payload, secret }) },
            body: payload,
        });
    };

    assert.match(await (await server.fetch("/sacred-struggle/")).text(), /Finding meaning in a world run by machines/);
    assert.equal((await webhook(paid, undefined, randomUUID())).status, 400);
    assert.equal((await webhook(other)).status, 204);
    assert.equal((await webhook(pending)).status, 204);
    assert.equal((await webhook(pending, "checkout.session.async_payment_succeeded")).status, 503);
    assert.equal((await server.fetch(url("download", other.id))).status, 404);
    assert.equal((await server.fetch(url("download", "cs_test_unknownOrder"))).status, 404);
    assert.equal((await server.fetch(url("download", pending.id))).status, 403);
    assert.equal((await server.fetch(url("download", paid.id))).status, 503);
    assert.equal((await webhook(paid)).status, 503, "a missing file leaves the webhook eligible for retry");

    await env.EBOOK_FILES.put("sacred-struggle.epub", book);
    const navigate = (path) => new Promise((resolve, reject) => {
        get(new URL(path, address.url), { headers: { "Sec-Fetch-Mode": "navigate" } }, (incoming) => {
            resolve(new Response(Readable.toWeb(incoming), { status: incoming.statusCode, headers: incoming.headers }));
        }).on("error", reject);
    });
    const thanks = await navigate(url("thanks", paid.id));
    assert.equal(thanks.status, 200);
    const thankYouHtml = await thanks.text();
    assert.match(thankYouHtml, /Your copy is ready/);
    assert.ok(thankYouHtml.includes(`href="${url("download", paid.id)}"`));
    assert.equal(thanks.headers.get("Referrer-Policy"), "no-referrer");

    const download = await navigate(url("download", paid.id));
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("Content-Type"), "application/epub+zip");
    assert.equal(download.headers.get("Cache-Control"), "private, no-store");
    assert.equal(await download.text(), book);

    orders.set(pending.id, { ...pending, payment_status: "paid" });
    const deliveries = await Promise.all([
        webhook(paid),
        webhook(paid),
        webhook(pending, "checkout.session.async_payment_succeeded"),
    ]);
    assert.equal(deliveries[2].status, 204);
    assert.ok(deliveries.slice(0, 2).some((response) => response.status === 204));
    assert.ok(deliveries.slice(0, 2).every((response) => [204, 503].includes(response.status)));
    assert.equal((await webhook(paid)).status, 204);

    // Wrangler writes simulated outbound email here until the test Worker shuts down.
    const emails = await Array.fromAsync(glob(".wrangler/tmp/email/miniflare-*/email-text/*.txt"));
    const messages = await Promise.all(emails.map((file) => readFile(file, "utf8")));
    for (const order of [paid, pending]) {
        const link = `https://kalon.solutions${url("thanks", order.id)}`;
        assert.equal(messages.filter((message) => message.includes(link)).length, 1);
    }

    let limited = false;
    for (let attempt = 0; attempt <= 20; attempt++) {
        const lookupsBefore = stripeLookups;
        const response = await server.fetch(url("download", "cs_test_unknownOrder"));
        await response.text();
        if (response.status === 429) {
            assert.equal(stripeLookups, lookupsBefore);
            limited = true;
            break;
        }
    }
    assert.ok(limited, "the buyer route limits repeated requests before querying Stripe");
});
