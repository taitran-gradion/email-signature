// SPDX-License-Identifier: BUSL-1.1
// SPDX-FileCopyrightText: 2026 Gradion

package emailsignature

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/margince/margince/backend/pkg/extension"
)

// maxSignatureLength bounds the markup a member may save. A signature is a
// few lines; this leaves room for inline styles without letting one row carry
// a newsletter.
const maxSignatureLength = 10000

// signature is what both routes answer: the caller's own markup, empty when
// they wrote none.
type signature struct {
	HTML      string     `json:"html"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}

// readSignature answers GET /ext/email-signature/mine.
func readSignature(ctx context.Context, rt extension.Runtime, _ json.RawMessage) (json.RawMessage, error) {
	member, err := memberOf(rt)
	if err != nil {
		return nil, err
	}
	var out signature
	err = rt.Tx(ctx, func(ctx context.Context, tx extension.Tx) error {
		out, err = signatureOf(ctx, tx, member)
		return err
	})
	if err != nil {
		return nil, err
	}
	return json.Marshal(out)
}

// saveSignature answers POST /ext/email-signature/mine: it replaces the
// caller's signature, and clears it when the markup is blank, so their mail
// signs with the workspace's template or their plain sign-off again.
func saveSignature(ctx context.Context, rt extension.Runtime, in json.RawMessage) (json.RawMessage, error) {
	args, err := extension.DecodeArgs[struct {
		HTML string `json:"html"`
	}](in)
	if err != nil {
		return nil, err
	}
	markup := strings.TrimSpace(args.HTML)
	if err := checkSignature(markup); err != nil {
		return nil, err
	}
	member, err := memberOf(rt)
	if err != nil {
		return nil, err
	}
	var out signature
	err = rt.Tx(ctx, func(ctx context.Context, tx extension.Tx) error {
		if markup == "" {
			_, err = tx.Exec(ctx, `DELETE FROM ext.ext_email_signature_signature WHERE owner_id = $1`, member)
		} else {
			_, err = tx.Exec(ctx, `
				INSERT INTO ext.ext_email_signature_signature (owner_id, html, updated_at)
				VALUES ($1, $2, now())
				ON CONFLICT (owner_id) DO UPDATE SET html = EXCLUDED.html, updated_at = now()`, member, markup)
		}
		if err != nil {
			return err
		}
		out, err = signatureOf(ctx, tx, member)
		return err
	})
	if err != nil {
		return nil, err
	}
	return json.Marshal(out)
}

// memberOf is the member behind the call. A signature is a person's own, so
// a call with nobody behind it has nothing to read or write.
func memberOf(rt extension.Runtime) (string, error) {
	member := rt.Caller().UserID
	if member == "" {
		return "", fmt.Errorf("%w: an email signature belongs to a member", extension.ErrForbidden)
	}
	return member, nil
}

func checkSignature(markup string) error {
	if len(markup) > maxSignatureLength {
		return fmt.Errorf("%w: an email signature is at most %d characters", extension.ErrInvalid, maxSignatureLength)
	}
	return nil
}

func signatureOf(ctx context.Context, tx extension.Tx, member string) (signature, error) {
	var out signature
	var updated time.Time
	err := tx.QueryRow(ctx, `
		SELECT html, updated_at FROM ext.ext_email_signature_signature WHERE owner_id = $1`, member).
		Scan(&out.HTML, &updated)
	if errors.Is(err, extension.ErrNoRows) {
		return signature{}, nil
	}
	if err != nil {
		return signature{}, err
	}
	out.UpdatedAt = &updated
	return out, nil
}
