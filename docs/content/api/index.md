# REST API

Everything the web interface does with transfers can be done over HTTP. This is
what makes the instance scriptable: a build server that ships nightly artefacts
to a client, a backup job handing over an export, or an AI assistant sending
files on your behalf.

## Authentication

Send an [API key](/docs/api-keys) in the `x-api-key` header:

```bash
curl -H "x-api-key: $KEY" https://transfer.example.com/api/transfers
```

A key acts as the person who created it and carries exactly their permissions.
Two limits are deliberate: a key can never administer users, and a key can never
create or revoke another key. Both are refused even for an administrator's key.

The **download** routes take no key at all. The token in the URL *is* the
credential, because recipients are people with no account on your instance.

## Errors

Errors come back as `{ "error": "CODE" }` with a matching HTTP status.

| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Missing, malformed, revoked or expired key |
| 403 | `API_KEY_READ_ONLY` | The key may not write |
| 403 | `API_KEY_CANNOT_ADMINISTER` | Admin endpoints refuse keys |
| 403 | `API_KEY_CANNOT_MANAGE_KEYS` | Keys cannot manage keys |
| 404 | `NOT_FOUND` | No such transfer — or not yours |
| 409 | `TRANSFER_ALREADY_SENT` | The transfer has already gone out |
| 429 | `TOO_MANY_REQUESTS` | Rate limited; see `Retry-After` |

Another account's transfer answers `404`, not `403`. That is on purpose: a
`403` would confirm the id exists, which turns the endpoint into a way to
enumerate them.

## Sending a transfer

Three steps, mirroring what the browser does. File bytes go over a normal
multipart upload rather than a JSON body, so a multi-gigabyte file streams to
disk instead of being buffered.

```bash
KEY=your-api-key
BASE=https://transfer.example.com

# 1. Create a draft. Omit "recipients" for a link-only transfer.
ID=$(curl -s -X POST "$BASE/api/transfers" \
  -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{"subject":"Nightly build","retentionDays":7,"recipients":["client@example.com"]}' \
  | jq -r .data.id)

# 2. Upload each file, one request each.
curl -s -X POST "$BASE/api/transfers/$ID/files" \
  -H "x-api-key: $KEY" -F "file=@build.zip"

# 3. Send it. This mails the recipients and starts the retention clock.
curl -s -X POST "$BASE/api/transfers/$ID/send" -H "x-api-key: $KEY"
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | [`/api/transfers`](/api/transfers) | Transfers you sent and received |
| `POST` | [`/api/transfers`](/api/transfers) | Create a draft |
| `POST` | [`/api/transfers/:id/files`](/api/upload) | Upload one file |
| `POST` | [`/api/transfers/:id/send`](/api/send) | Deliver it |
| `DELETE` | [`/api/transfers/:id`](/api/transfers) | Revoke it — files erased |
| `GET` | [`/api/download/:token`](/api/download) | Public transfer contents |
| `GET` | [`/api/recipients`](/api/recipients) | Team members you can address |
| `GET` | `/api/health` | Liveness, including the database |

Key management (`/api/auth/api-key`) is session-only and deliberately not part
of this API.
