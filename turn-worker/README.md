# TURN Credential Worker

This Cloudflare Worker keeps the Metered TURN API key off the public GitHub Pages JavaScript. It returns short-lived ICE server credentials to the game and limits each client IP to 60 requests per minute.

## Configure and deploy

1. Create a Metered account and a TURN credential. Copy the app name and that credential's API key from the Metered dashboard.
2. In `wrangler.toml`, replace `SET_YOUR_METERED_APP_NAME` with the app name. If Cloudflare reports that rate-limit namespace `7412639` is already used, choose a different unique integer.
3. From this folder, run `npx wrangler login` and then `npx wrangler secret put METERED_TURN_API_KEY`. Paste the credential-scoped API key directly into the terminal prompt. Do not put it in GitHub or this file.
4. Deploy with `npx wrangler deploy`. The endpoint will be `https://fun-friday-turn-credentials.<your-workers-subdomain>.workers.dev/turn-credentials`.
5. In the game root `index.html`, put that endpoint URL in the `turn-credentials-endpoint` meta tag, then publish the updated game.

The Worker allows requests from the GitHub Pages origin and localhost for testing. It returns TURN ICE servers, never the Metered API key. The free TURN quota is limited, so monitor usage in the Metered dashboard.
