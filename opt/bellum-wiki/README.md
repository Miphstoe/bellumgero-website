# Bellum Gero Wiki.js Deployment

This folder mirrors the intended production path of `/opt/bellum-wiki` on your Ubuntu server.

It deploys:

- `Wiki.js` with Docker using `requarks/wiki:2`
- `PostgreSQL` as the backing database
- `Nginx` reverse proxy config for `wiki.bellumgero.net`

Wiki.js is a good fit here because it supports Docker deployment and database configuration using environment variables such as `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, and `DB_NAME`.

References:

- Wiki.js Docker docs: https://beta.js.wiki/docs/install-using-docker
- Wiki.js requirements docs: https://beta.js.wiki/docs/requirements

## Files

- `docker-compose.yml`
- `.env.example`
- `nginx-wiki.conf`

## Deployment Steps

1. Create the target directory on the Ubuntu server:

```bash
sudo mkdir -p /opt/bellum-wiki
sudo chown -R $USER:$USER /opt/bellum-wiki
```

2. Copy these files into:

```bash
/opt/bellum-wiki
```

3. Change into the directory:

```bash
cd /opt/bellum-wiki
```

4. Create the real environment file:

```bash
cp .env.example .env
```

5. Edit the environment file and set a strong database password:

```bash
nano .env
```

6. Start the stack:

```bash
docker compose up -d
```

7. Confirm the containers are running:

```bash
docker ps
```

8. Test Wiki.js locally on the server before wiring Nginx:

```bash
curl http://127.0.0.1:3001
```

You should get an HTTP response from Wiki.js, usually HTML.

## Nginx Setup

1. Place the provided Nginx file in your Nginx available-sites directory. A common location is:

```bash
sudo cp /opt/bellum-wiki/nginx-wiki.conf /etc/nginx/sites-available/wiki.bellumgero.net.conf
```

2. Enable the config:

```bash
sudo ln -s /etc/nginx/sites-available/wiki.bellumgero.net.conf /etc/nginx/sites-enabled/wiki.bellumgero.net.conf
```

3. Test Nginx configuration:

```bash
sudo nginx -t
```

4. Reload Nginx:

```bash
sudo systemctl reload nginx
```

If your server uses a different Nginx layout, place `nginx-wiki.conf` wherever your existing site-specific reverse proxy files live. This config is intentionally separate so it does not overwrite the existing Bellum Gero website config.

## Cloudflare DNS

Create a DNS entry for:

```text
wiki.bellumgero.net
```

Recommended options:

- Create an `A` record pointing `wiki.bellumgero.net` to your Ubuntu server public IP
- Or create a `CNAME` pointing `wiki.bellumgero.net` to your tunnel or upstream hostname if you use Cloudflare Tunnel

If you proxy traffic through Cloudflare, the provided Nginx config remains compatible because it forwards the standard proxy headers expected by upstream applications.

## First Login / Initial Setup

Once DNS and Nginx are active, open:

```text
https://wiki.bellumgero.net
```

Complete the Wiki.js initial setup wizard in the browser.

## Recommended Initial Wiki Structure

- Getting Started
- Server Rules
- Player Interaction Expectations
- Custom Server Features
- Jedi System
- Path of Awakening
- Holocron of Destiny
- Village Rewards
- Professions
- Beast Master
- Bio-Engineer
- Creature Handler
- Entertainer
- Medic
- Commando
- Galaxy Combat Board
- BG Tokens
- Veteran Rewards
- Events
- Technical Support
- Full Scan Instructions
- Launcher Install Guide
- Troubleshooting TRE Issues

## Permissions / Security Recommendation

Recommended permission model:

- Public users can read only
- Registered players can submit or suggest edits
- Staff can approve and manage pages
- Admins have full access

Avoid open public editing to prevent spam, low-quality edits, or vandalism.

## Notes

- Wiki.js requires a dedicated subdomain and should not be mounted under a `/wiki` subfolder.
- PostgreSQL data is stored in `./postgres-data` for persistence.
- The compose file does not hardcode secrets. Set them in `.env`.
- If you later add SSL termination directly in Nginx or through Cloudflare, keep the upstream target as `http://127.0.0.1:3001`.
