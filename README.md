# Astro Starter Kit: Basics

```sh
pnpm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |

## Sacred Struggle EPUB checkout

Stripe Managed Payments hosts checkout. The Cloudflare Worker verifies payment, serves the EPUB from private R2 storage, and emails a link to the download page. The EPUB stays outside the Git repository and the site's public assets.

1. In Stripe, create a one-time €16 tax-inclusive Payment Link dedicated to this e-book. Enable Managed Payments, select the applicable e-book tax code, and set the after-payment redirect to `https://kalon.solutions/sacred-struggle/thanks?session_id={CHECKOUT_SESSION_ID}`.
2. In Cloudflare, [enable R2](https://developers.cloudflare.com/r2/get-started/#before-you-begin) and set up [Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/) for `kalon.solutions`. Use a Workers Paid plan for delivery to buyers. The Worker sends from `downloads@kalon.solutions`.
3. Set the Worker variable `STRIPE_EBOOK_PAYMENT_LINK` to the Payment Link ID (`plink_…`) and set `STRIPE_EBOOK_READ_KEY` as a Worker secret with read access to Stripe Checkout Sessions. Use a key from the same Stripe mode as the link. Keep `SACRED_STRUGGLE_CHECKOUT_URL` unset while setting up delivery.
4. Deploy the Worker, then upload the release file as `sacred-struggle.epub` to the private R2 bucket bound as `EBOOK_FILES`. Wrangler provisions the bucket if necessary. Keep its public URL disabled.
5. In Stripe, register `https://kalon.solutions/api/sacred-struggle/stripe` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Set its signing secret as the `STRIPE_EBOOK_WEBHOOK_SECRET` Worker secret.
6. Verify a Stripe sandbox order, the downloaded EPUB, and the email. When ready to accept live orders, use the live Stripe settings and set `SACRED_STRUGGLE_CHECKOUT_URL` in the Cloudflare **build** environment to the live HTTPS Payment Link. Build and deploy again to show **Buy EPUB directly** next to the retailer links.

Run `pnpm check:worker` for type checking and `pnpm test:ebook` for local Worker tests. The tests use simulated Cloudflare storage and email and mock Stripe responses.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
