// SPDX-License-Identifier: BUSL-1.1
// SPDX-FileCopyrightText: 2026 Gradion

// Package emailsignature gives every member an HTML email signature of their
// own. Core signs mail with the workspace's HTML template, or a member's
// plain-text sign-off; this unit lets a member write their own layout, which
// then stands in for the workspace's template on every send they make.
//
//	signature.go  its routes: read and save the caller's own signature
//	migrations/   its table, one row per member who wrote a signature
//	overlays/     the one core function it decorates: contacts.SignatureFor,
//	              which hands the send path the sender's signature
//	api/          its routes, merged into core's contract
//	frontend/     the page a member writes their signature on, with a preview
//
// The signature goes through core's own template path, so it takes the same
// placeholders ({name}, {title}, {phone}, {logo}) and the same sanitizer: a
// send keeps paragraphs, line breaks, bold, italic, underline, links and
// coloured, sized spans, and drops everything else.
package emailsignature

import (
	"embed"

	"github.com/margince/margince/backend/pkg/extension"
)

//go:embed migrations
var migrations embed.FS

// New returns the unit's declaration: everything it gives core, in one place.
func New() extension.Extension {
	return extension.Extension{
		Name:        "email-signature",
		Version:     "0.1.0",
		Description: "An HTML email signature for every member, used on every send they make.",
		Tools: []extension.Tool{
			{Name: "email_signature_read", Handle: readSignature},
			{Name: "email_signature_save", Handle: saveSignature},
		},
		Migrations: migrations,
	}
}
