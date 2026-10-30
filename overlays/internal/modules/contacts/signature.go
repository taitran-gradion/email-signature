//go:build margince_overlay

// SPDX-License-Identifier: BUSL-1.1
// SPDX-FileCopyrightText: 2026 Gradion

package contacts

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/margince/margince/backend/internal/shared/kernel/ids"
)

// SignatureFor is what the send path asks for the sender's sign-off, and the
// composer's preview asks the same, so a member's own HTML signature stands in
// for the workspace's template in both. Core then fills its placeholders and
// sanitizes it exactly as it does the template.
//
//margince:decorate
func (s *Store) SignatureFor(ctx context.Context, userID ids.UUID) (SenderSignature, error) {
	out, err := s.SignatureFor__core(ctx, userID)
	if err != nil {
		return out, err
	}
	var own string
	err = s.db.Tx(ctx, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			SELECT html FROM ext.ext_email_signature_signature WHERE owner_id = $1`, userID).Scan(&own)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	})
	if err != nil {
		return SenderSignature{}, fmt.Errorf("email-signature: reading the sender's HTML signature: %w", err)
	}
	if strings.TrimSpace(own) != "" {
		out.Template = own
	}
	return out, nil
}
