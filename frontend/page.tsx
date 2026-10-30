import { problemMessageOf } from "@margince/frontend/api";
import { useLocale, useT } from "@margince/frontend/app";
import { Badge, Button, Callout, Card, Field, Row, SectionHeader, Stack } from "@margince/frontend/design-system";
import { useEffect, useState } from "react";
import { refusedForRole, useMySignature, useSaveSignature, useSignOffPreview } from "./api";

// A starting point a member edits rather than a blank box.
const STARTER = `<p><b>{name}</b><br>{title}<br>{phone}</p>
<p>{logo}</p>`;

// How long typing pauses before the preview asks again.
const SETTLE_MS = 400;

// #/ext/email-signature: the caller's own HTML signature, beside the sign-off
// a send would append with it.
export function SignaturePage() {
  const t = useT();
  const { locale } = useLocale();
  const mine = useMySignature();
  const save = useSaveSignature();
  const [draft, setDraft] = useState<string | null>(null);
  const saved = mine.data?.html ?? "";
  const markup = draft ?? saved;
  const settled = useSettled(markup);
  const preview = useSignOffPreview(settled);
  const changed = draft !== null && draft.trim() !== saved;
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="wrap">
      <SectionHeader title={t("extEmailSignature.title")} level={1} />
      <p>{t("extEmailSignature.sub")}</p>
      {mine.error && (
        <Callout tone="danger" title={t("extEmailSignature.failed")}>
          {refusedForRole(mine.error) ? t("extEmailSignature.needsGrant") : problemMessageOf(mine.error, t)}
        </Callout>
      )}
      {save.error && (
        <Callout tone="danger" title={t("extEmailSignature.saveFailed")}>
          {refusedForRole(save.error) ? t("extEmailSignature.needsGrant") : problemMessageOf(save.error, t)}
        </Callout>
      )}
      <div className="ext-email-signature">
        <Card>
          <Stack gap="3">
            <Row gap="2">
              <strong>{t("extEmailSignature.markup")}</strong>
              {saved === "" ? (
                <Badge tone="default">{t("extEmailSignature.none")}</Badge>
              ) : (
                <Badge tone="success">{t("extEmailSignature.active")}</Badge>
              )}
            </Row>
            <Field label={t("extEmailSignature.markup")} labelHidden hint={t("extEmailSignature.hint")}>
              {(control) => (
                <textarea
                  {...control}
                  className="textarea ext-email-signature-code"
                  spellCheck={false}
                  rows={14}
                  maxLength={10000}
                  value={markup}
                  placeholder={STARTER}
                  onChange={(event) => setDraft(event.target.value)}
                />
              )}
            </Field>
            <Row gap="2">
              <Button
                variant="primary"
                disabled={!changed || save.isPending}
                onClick={() => save.mutate(markup, { onSuccess: () => setDraft(null) })}
              >
                {t("extEmailSignature.save")}
              </Button>
              {markup.trim() === "" && <Button onClick={() => setDraft(STARTER)}>{t("extEmailSignature.start")}</Button>}
              {saved !== "" && (
                <Button
                  disabled={save.isPending}
                  onClick={() => save.mutate("", { onSuccess: () => setDraft(null) })}
                >
                  {t("extEmailSignature.clear")}
                </Button>
              )}
            </Row>
            {mine.data?.updated_at && (
              <small>{t("extEmailSignature.updated", { when: when.format(new Date(mine.data.updated_at)) })}</small>
            )}
          </Stack>
        </Card>
        <Card>
          <Stack gap="3">
            <strong>{t("extEmailSignature.preview")}</strong>
            {settled.trim() === "" && <p>{t("extEmailSignature.previewEmpty")}</p>}
            {settled.trim() !== "" && preview.error && (
              <Callout tone="warning" title={t("extEmailSignature.previewFailed")}>
                {problemMessageOf(preview.error, t)}
              </Callout>
            )}
            {settled.trim() !== "" && preview.data?.html && (
              <iframe
                className="ext-email-signature-preview"
                title={t("extEmailSignature.preview")}
                sandbox=""
                srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;font:14px/1.4 sans-serif">${preview.data.html}</body>`}
              />
            )}
            {settled.trim() !== "" && preview.data && (
              <details>
                <summary>{t("extEmailSignature.plainText")}</summary>
                <pre className="ext-email-signature-text">{preview.data.text}</pre>
              </details>
            )}
          </Stack>
        </Card>
      </div>
    </div>
  );
}

// The value once typing has paused, so the preview is not asked per keystroke.
function useSettled(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}
