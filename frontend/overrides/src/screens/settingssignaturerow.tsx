import { useT } from "@margince/frontend/app";
import { IconAction, SegmentedControl } from "@margince/frontend/design-system";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useId, useState } from "react";
import { api } from "@core-original/src/api/client";
import { useUnsavedGuard } from "@core-original/src/components/unsaved";
import { Button, Field, Modal, Textarea, TextInput } from "@core-original/src/design-system/atoms";
import { Heading } from "@core-original/src/design-system/heading";
import { WriteRefused } from "@core-original/src/design-system/querystates";
import { SettingRow } from "@core-original/src/design-system/settingrow";
import type { Toast } from "@core-original/src/design-system/toast";
import { unwrap } from "@core-original/src/lib/problem";
import { useSignOff } from "@core-original/src/screens/composesignoff";
import { useSaveSignature } from "@core-original/src/screens/settingssignature";
import { SignatureHtml } from "@core-original/src/screens/signaturehtml";
import { useMySignature, useSaveSignature as useSaveHtmlSignature } from "../../../api";

type Draft = { body: string; title: string; phone: string };

// "core" is what core signs with: the workspace template, or the member's own
// plain text. "html" is the member's own HTML signature, kept by this unit.
type Mode = "core" | "html";

// Core's Email signature row on Settings › Account, with one more choice in
// its dialog: the member's own HTML signature. Title and phone stay core's, and
// fill {title} and {phone} in the HTML as they do in the workspace template.
export function SignatureSettingRow({ toast }: Readonly<{ toast: Toast }>) {
  const t = useT();
  const titleId = useId();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mode, setMode] = useState<Mode>("core");
  const [htmlDraft, setHtmlDraft] = useState<string | null>(null);
  const signature = useQuery({
    queryKey: ["me-email-signature"],
    queryFn: async () => {
      return unwrap(await api.GET("/me/email-signature"));
    },
  });
  const mine = useMySignature();
  const saveHtml = useSaveHtmlSignature();
  const templated = signature.data?.template_active === true;
  const save = useSaveSignature((saved) => {
    // Hand the edit back to the server's answer: it trims what it stores.
    setDraft(saved ? { body: saved.body, title: saved.title, phone: saved.phone } : null);
    setOpen(false);
    toast.show(t("settings.saved"));
  });

  const stored: Draft = {
    body: signature.data?.body ?? "",
    title: signature.data?.title ?? "",
    phone: signature.data?.phone ?? "",
  };
  const storedHtml = mine.data?.html ?? "";
  // The saved values until the member types; theirs from then on.
  const shown = draft ?? stored;
  const html = htmlDraft ?? storedHtml;
  // What Save writes to the HTML signature: nothing unless HTML is chosen.
  const nextHtml = mode === "html" ? html.trim() : "";
  const coreDirty = shown.body !== stored.body || shown.title !== stored.title || shown.phone !== stored.phone;
  const htmlDirty = nextHtml !== storedHtml;
  const dirty = coreDirty || htmlDirty;
  const pending = save.isPending || saveHtml.isPending;
  useUnsavedGuard(open && dirty);
  // The preview shows what is typed, before it is saved: the HTML in place of
  // the template when HTML is chosen.
  const rendered = useSignOff(
    "",
    "",
    mode === "html"
      ? { template: html, title: shown.title, phone: shown.phone }
      : draft === null
        ? undefined
        : { title: draft.title, phone: draft.phone },
  ).signOff;
  // What a send appends today, shown on the row itself.
  const current = useSignOff("", "").signOff;
  const change = (field: keyof Draft, value: string) => setDraft({ ...shown, [field]: value });

  const answer =
    signature.isPending || mine.isPending ? undefined : rowAnswer(t, storedHtml !== "", templated, stored.body);

  const close = () => setOpen(false);
  const edit = () => {
    setDraft(null);
    setHtmlDraft(null);
    setMode(storedHtml === "" ? "core" : "html");
    save.reset();
    saveHtml.reset();
    setOpen(true);
  };
  const submit = async () => {
    if (!dirty || pending) return;
    if (htmlDirty) {
      try {
        await saveHtml.mutateAsync(nextHtml);
      } catch {
        return; // WriteRefused below says why.
      }
    }
    if (coreDirty) {
      save.mutate(shown);
      return;
    }
    setOpen(false);
    toast.show(t("settings.saved"));
  };

  const titleAndPhone = (
    <>
      <Field label={t("settings.signatureTitle")}>
        {(control) => (
          <TextInput {...control} value={shown.title} onChange={(event) => change("title", event.target.value)} />
        )}
      </Field>
      <Field label={t("settings.signaturePhone")}>
        {(control) => (
          <TextInput {...control} value={shown.phone} onChange={(event) => change("phone", event.target.value)} />
        )}
      </Field>
    </>
  );

  return (
    <>
      <SettingRow
        label={t("settings.signature")}
        description={t("settings.signatureSub")}
        value={answer}
        layout="stack"
        control={
          <div className="ext-email-signature-current">
            <div className="ext-email-signature-current-edit">
              <IconAction label={t("settings.signatureEdit")} icon={<Pencil size={16} aria-hidden />} onClick={edit} />
            </div>
            {current?.html ? (
              <SignatureHtml html={current.html} title={t("settings.signaturePreview")} />
            ) : current?.text ? (
              <p className="ext-email-signature-current-text">{current.text}</p>
            ) : (
              <p className="t-caption">{t("settings.signatureNone")}</p>
            )}
          </div>
        }
      />
      <Modal open={open} onClose={close} labelledBy={titleId} intent="form">
        <Heading size="large" className="t-h3 modal-title" id={titleId}>
          {t("settings.signature")}
        </Heading>
        {/* A real form: nothing is written until Save is pressed. */}
        <form
          id={formId}
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <WriteRefused titleKey="settings.saveFailed" error={saveHtml.error ?? save.error} />
          <SegmentedControl
            label={t("extEmailSignature.mode.label")}
            options={["core", "html"] as const}
            value={mode}
            onChange={setMode}
            labels={{
              core: templated ? t("settings.signatureFromTemplate") : t("extEmailSignature.mode.plain"),
              html: t("extEmailSignature.mode.html"),
            }}
          />
          {mode === "html" && (
            <>
              <Field label={t("extEmailSignature.markup")} hint={t("extEmailSignature.hint")}>
                {(control) => (
                  <Textarea
                    {...control}
                    className="ext-email-signature-code"
                    rows={8}
                    spellCheck={false}
                    maxLength={10000}
                    value={html}
                    placeholder={t("extEmailSignature.example")}
                    onChange={(event) => setHtmlDraft(event.target.value)}
                  />
                )}
              </Field>
              <p className="t-caption">{t("extEmailSignature.placeholders")}</p>
              {titleAndPhone}
              {html.trim() !== "" && rendered?.html ? (
                <SignatureHtml html={rendered.html} title={t("settings.signaturePreview")} />
              ) : null}
            </>
          )}
          {mode === "core" && storedHtml !== "" && <p className="t-caption">{t("extEmailSignature.switchBack")}</p>}
          {mode === "core" && templated && (
            <>
              <p className="t-caption">{t("settings.signatureTemplateHint")}</p>
              {titleAndPhone}
              {storedHtml === "" && rendered?.html ? (
                <SignatureHtml html={rendered.html} title={t("settings.signaturePreview")} />
              ) : null}
            </>
          )}
          {mode === "core" && !templated && (
            <>
              <Field label={t("settings.signatureLabel")}>
                {(control) => (
                  <Textarea
                    {...control}
                    rows={5}
                    value={shown.body}
                    placeholder={t("settings.signaturePlaceholder")}
                    onChange={(event) => change("body", event.target.value)}
                  />
                )}
              </Field>
              <p className="t-caption">{t("settings.signatureHint")}</p>
            </>
          )}
        </form>
        <div className="actions">
          <Button variant="ghost" onClick={close}>
            {t("settings.signatureCancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            disabled={!pending && !dirty}
            pending={pending}
            busyLabel={t("settings.signatureSaving")}
          >
            {t("record.save")}
          </Button>
        </div>
      </Modal>
    </>
  );
}

// The row's value: what the member's mail signs with. The caller claims
// nothing before the reads have answered.
function rowAnswer(t: ReturnType<typeof useT>, hasHtml: boolean, templated: boolean, body: string): string {
  if (hasHtml) {
    return t("extEmailSignature.row.html");
  }
  if (templated) {
    return t("settings.signatureFromTemplate");
  }
  const firstLine = (body.split("\n")[0] ?? "").trim();
  return firstLine === "" ? t("settings.signatureNone") : firstLine;
}
