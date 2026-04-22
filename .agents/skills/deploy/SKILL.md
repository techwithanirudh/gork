---
name: deploy
description: Deploy the gork Discord bot. Use when the user says "deploy", "ship it", "rebuild", "docker build", or wants to restart the bot.
---

Deploy gork by running these steps in order:

## Steps

1. **Deploy slash commands**: register any command changes with Discord:
   ```
   bun run deploy
   ```

2. **Rebuild and restart**: build a fresh Docker image and bring it up:
   ```
   docker compose build && docker compose up -d
   ```

3. **Verify**: tail the logs to confirm the bot came up healthy:
   ```
   docker compose logs --tail=20 gork
   ```

Look for `Bot is ready!` and `Redis connected` in the logs. If either is missing, show the full log output to the user.

All commands should be run from `/home/node/Services/gork`.
