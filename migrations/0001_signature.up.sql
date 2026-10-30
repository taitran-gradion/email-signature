-- SPDX-License-Identifier: BUSL-1.1
-- SPDX-FileCopyrightText: 2026 Gradion
--
-- One HTML signature per member who wrote one. Clearing it deletes the row,
-- and their mail signs as core signs it again.

CREATE TABLE ext.ext_email_signature_signature (
    owner_id    uuid        NOT NULL PRIMARY KEY,
    html        text        NOT NULL CHECK (length(html) BETWEEN 1 AND 10000),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON ext.ext_email_signature_signature TO margince_app;
