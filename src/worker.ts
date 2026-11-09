import { Buffer } from "node:buffer";
import Stripe from "stripe";

const BOOK_URL = "https://kalon.solutions/sacred-struggle";
const THANK_YOU_PATH = "/sacred-struggle/thanks";
const DOWNLOAD_PATH = "/sacred-struggle/download";
const WEBHOOK_PATH = "/api/sacred-struggle/stripe";
const EPUB_NAME = "sacred-struggle.epub";
const SESSION_ID = /^cs_(?:test|live)_[a-zA-Z0-9]{8,120}$/;
const EMAIL_LEASE_MS = 10 * 60 * 1000;

interface Env extends WorkerBindings {
    STRIPE_EBOOK_READ_KEY?: string;
    STRIPE_EBOOK_PAYMENT_LINK?: string;
    STRIPE_EBOOK_WEBHOOK_SECRET?: string;
}

const privateHeaders = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
};

async function sendDeliveryEmail(env: Env, email: string, sessionId: string): Promise<void> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
    const orderKey = `deliveries/${Buffer.from(digest).toString("hex")}`;
    const sentKey = `${orderKey}/sent`;
    if (await env.EBOOK_FILES.head(sentKey)) return;

    const claimKey = `${orderKey}/claim`;
    const previous = await env.EBOOK_FILES.head(claimKey);
    if (previous && Date.now() - previous.uploaded.getTime() < EMAIL_LEASE_MS) {
        throw new Error("An ebook delivery is in progress.");
    }

    // After an interruption, Stripe can claim delivery again once the lease expires.
    const claim = await env.EBOOK_FILES.put(claimKey, crypto.randomUUID(), {
        onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: "*" },
    });
    if (!claim) throw new Error("Another webhook claimed the ebook delivery.");
    if (await env.EBOOK_FILES.head(sentKey)) return;

    const downloadPage = new URL(THANK_YOU_PATH, BOOK_URL);
    downloadPage.searchParams.set("session_id", sessionId);
    await env.EBOOK_EMAIL.send({
        from: "downloads@kalon.solutions",
        to: email,
        subject: "Your copy of Sacred Struggle",
        text: `Thank you for buying Sacred Struggle. Download your EPUB here:\n\n${downloadPage.href}\n\nIf you need help, email marcel@samyn.co.\n\nMarcel`,
        html: `<div style="background:#f6f0e7;padding:24px 12px;color:#263e49">
  <div style="max-width:480px;margin:auto;background:#fffcf7;border:1px solid #e2d7c9;padding:28px;font-family:Arial,sans-serif;line-height:1.6">
    <p style="margin:0 0 8px;color:#874a24;font-size:11px;letter-spacing:.16em;text-transform:uppercase">Sacred Struggle · EPUB</p>
    <h1 style="margin:0;font:32px/1.2 Georgia,serif">Your copy is ready.</h1>
    <p>Thank you for buying Sacred Struggle. You can come back to this email whenever you need the file.</p>
    <p style="margin:24px 0"><a href="${downloadPage.href}" style="display:inline-block;background:#874a24;color:#fff;border-radius:24px;padding:10px 20px;text-decoration:none">Get your EPUB</a></p>
    <p>Happy reading,<br>Marcel</p>
    <p style="border-top:1px solid #e2d7c9;padding-top:12px;font-size:13px">Need help? <a href="mailto:marcel@samyn.co" style="color:#315467">Email me</a>.</p>
  </div>
</div>`,
    });
    await env.EBOOK_FILES.put(sentKey, "sent");
}

interface OrderPage {
    title: string;
    note: string;
    status: number;
    download?: string;
}

async function orderPage(env: Env, { title, note, status, download }: OrderPage): Promise<Response> {
    const template = await env.ASSETS.fetch(new Request(new URL(`${THANK_YOU_PATH}/`, BOOK_URL)));
    if (!template.ok) return new Response(title, { status, headers: privateHeaders });

    const rewriter = new HTMLRewriter()
        .on("title", { element: (el) => { el.setInnerContent(`${title} | Sacred Struggle`); } })
        .on("#order-title", { element: (el) => { el.setInnerContent(title); } })
        .on("#order-note", { element: (el) => { el.setInnerContent(note); } });

    if (download) {
        rewriter
            .on("#order-status", { element: (el) => { el.setInnerContent("Order confirmed · EPUB"); } })
            .on("#order-download", { element: (el) => { el.removeAttribute("hidden"); } })
            .on("#order-download a", { element: (el) => { el.setAttribute("href", download); } });
    }

    return rewriter.transform(new Response(template.body, {
        status,
        headers: {
            ...privateHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "X-Robots-Tag": "noindex, nofollow",
            "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src https://fonts.gstatic.com; base-uri 'none'; frame-ancestors 'none'",
        },
    }));
}

function unavailable(env: Env): Promise<Response> {
    return orderPage(env, {
        title: "Download temporarily unavailable",
        note: "Try your download link again shortly.",
        status: 503,
    });
}

function matchesBook(session: Stripe.Checkout.Session, paymentLink: string | undefined): boolean {
    return Boolean(paymentLink) && session.mode === "payment" && session.payment_link === paymentLink;
}

async function getSession(stripe: Stripe, id: string): Promise<Stripe.Checkout.Session | null> {
    try {
        return await stripe.checkout.sessions.retrieve(id);
    } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") {
            return null;
        }
        throw error;
    }
}

async function buyerRequest(url: URL, downloadFile: boolean, stripe: Stripe, env: Env): Promise<Response> {
    const id = url.searchParams.get("session_id");
    const session = id && SESSION_ID.test(id) ? await getSession(stripe, id) : null;
    if (!session || !matchesBook(session, env.STRIPE_EBOOK_PAYMENT_LINK)) {
        return orderPage(env, {
            title: "Order not found",
            note: "Open the download link from your order email.",
            status: 404,
        });
    }

    if (session.payment_status !== "paid") {
        return orderPage(env, {
            title: "Payment not confirmed",
            note: "You’ll get a download link by email once Stripe confirms payment.",
            status: 403,
        });
    }

    if (!downloadFile) {
        if (!(await env.EBOOK_FILES.head(EPUB_NAME))) return unavailable(env);

        const download = `${DOWNLOAD_PATH}?session_id=${encodeURIComponent(session.id)}`;
        return orderPage(env, {
            title: "Your copy is ready.",
            note: "Thank you for buying Sacred Struggle. I’m glad to share it with you.",
            status: 200,
            download,
        });
    }

    const epub = await env.EBOOK_FILES.get(EPUB_NAME);
    if (!epub) return unavailable(env);

    return new Response(epub.body, {
        headers: {
            ...privateHeaders,
            "Content-Type": "application/epub+zip",
            "Content-Disposition": `attachment; filename="${EPUB_NAME}"`,
            "Content-Length": String(epub.size),
        },
    });
}

async function stripeWebhook(request: Request, stripe: Stripe, env: Env): Promise<Response> {
    const signature = request.headers.get("Stripe-Signature");
    if (!signature) return new Response(null, { status: 400 });
    if (!env.STRIPE_EBOOK_WEBHOOK_SECRET) return new Response(null, { status: 503 });

    let event: Stripe.Event;
    const payload = await request.text();
    try {
        event = await stripe.webhooks.constructEventAsync(
            payload, signature, env.STRIPE_EBOOK_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider(),
        );
    } catch {
        return new Response(null, { status: 400 });
    }

    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
        return new Response(null, { status: 204 });
    }

    const checkout = event.data.object;
    if (!matchesBook(checkout, env.STRIPE_EBOOK_PAYMENT_LINK) || !SESSION_ID.test(checkout.id)) {
        return new Response(null, { status: 204 });
    }

    // Retrieve the current order so a delayed or retried event uses the current payment state.
    const session = await getSession(stripe, checkout.id);
    if (!session || !matchesBook(session, env.STRIPE_EBOOK_PAYMENT_LINK)) {
        throw new Error("Could not retrieve the ebook checkout session.");
    }
    if (session.payment_status !== "paid") {
        if (event.type === "checkout.session.async_payment_succeeded" || checkout.payment_status === "paid") {
            throw new Error("Stripe has not confirmed the ebook payment in the checkout session.");
        }
        return new Response(null, { status: 204 });
    }

    const email = session.customer_details?.email;
    if (!email || !(await env.EBOOK_FILES.head(EPUB_NAME))) {
        throw new Error("Paid ebook order is missing an email address or the release EPUB.");
    }
    await sendDeliveryEmail(env, email, session.id);
    return new Response(null, { status: 204 });
}

export default {
    async fetch(request, env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/$/, "");
        const webhook = path === WEBHOOK_PATH;
        const downloadFile = path === DOWNLOAD_PATH;
        if (!webhook && path !== THANK_YOU_PATH && !downloadFile) {
            return env.ASSETS.fetch(request);
        }

        const method = webhook ? "POST" : "GET";
        if (request.method !== method) {
            return new Response(null, { status: 405, headers: { Allow: method } });
        }
        if (!env.STRIPE_EBOOK_READ_KEY || !env.STRIPE_EBOOK_PAYMENT_LINK) {
            return webhook ? new Response(null, { status: 503 }) : unavailable(env);
        }

        const stripe = new Stripe(env.STRIPE_EBOOK_READ_KEY, {
            httpClient: Stripe.createFetchHttpClient(),
            maxNetworkRetries: 0,
            timeout: 3000,
        });
        try {
            if (webhook) return await stripeWebhook(request, stripe, env);

            const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
            if (!(await env.EBOOK_RATE_LIMIT.limit({ key })).success) {
                return orderPage(env, {
                    title: "Too many requests",
                    note: "Wait a minute and try the download link again.",
                    status: 429,
                });
            }
            return await buyerRequest(url, downloadFile, stripe, env);
        } catch (error) {
            // Do not log checkout IDs, buyer email addresses, or provider responses.
            console.error("Sacred Struggle delivery failed", {
                route: url.pathname,
                errorType: error instanceof Error ? error.name : "UnknownError",
            });
            return webhook ? new Response(null, { status: 503 }) : unavailable(env);
        }
    },
} satisfies ExportedHandler<Env>;
