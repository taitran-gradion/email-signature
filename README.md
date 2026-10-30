# email-signature

A Margince extension unit that gives every member their own HTML email signature.

- **Settings › Account › Email signature** shows the signature as recipients see it; the pencil opens the editor, where *Sign with* switches between core's signature (plain text or the workspace template) and *My HTML signature*, with a live preview.
- **`#/ext/email-signature`** is a full-page editor with the preview and its plain-text version.
- MCP tools: `email_signature_read`, `email_signature_save`.

The HTML goes through core's own template path, so it takes the placeholders `{name}`, `{title}`, `{phone}` and `{logo}`, and the same sanitizer: paragraphs, line breaks, bold, italic, underline, links and coloured or sized spans are kept, everything else is dropped.

```html
<p><b><span style="color:#1f3a93;font-size:16px">{name}</span></b><br>
<span style="color:#555555;font-size:13px">{title}</span></p>
<p><span style="font-size:13px">{phone}</span><br><a href="https://gradion.com">gradion.com</a></p>
<p>{logo}</p>
```

## How it hooks in

| Piece | What it does |
| --- | --- |
| `overlays/internal/modules/contacts/signature.go` | Decorates core's `contacts.(*Store).SignatureFor`: a member's own HTML stands in for the workspace template on every send and preview. |
| `frontend/overrides/src/screens/settingssignaturerow.tsx` | Replaces core's Email signature row on Settings › Account. |
| `migrations/` | `ext.ext_email_signature_signature`, one row per member. |
| `api/crm.yaml` | `GET`/`POST /v1/ext/email-signature/mine`. |

Both the overlay and the override are pinned (`overlays.lock`, `frontend/overrides.lock`) to the core source they were written against, so a core change stops the build until they are re-read. They need a core with overlay and override support, and only compose from an installation's own folder (a `replace` in `extensions.mod`):

```
require github.com/taitran-gradion/email-signature v0.0.0
replace github.com/taitran-gradion/email-signature => ./addons/email-signature
```

Roles need `ext_email_signature_signature` (read, update) under Settings › Roles.
