import { api, ProblemError, throwProblem } from "@margince/frontend/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const signatureKey = ["ext", "email-signature", "mine"] as const;

// The caller's own HTML signature, empty when they wrote none.
export function useMySignature() {
  return useQuery({
    queryKey: signatureKey,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/ext/email-signature/mine");
      if (error) throwProblem(error);
      return data;
    },
  });
}

// Saves the caller's signature; blank markup clears it.
export function useSaveSignature() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (html: string) => {
      const { data, error } = await api.POST("/ext/email-signature/mine", { body: { html } });
      if (error) throwProblem(error);
      return data;
    },
    onSuccess: (saved) => {
      client.setQueryData(signatureKey, saved);
      // The composer's sign-off under every draft now signs with it.
      void client.invalidateQueries({ queryKey: ["email-sign-off"] });
    },
  });
}

// The sign-off a send would append with this markup in place of the saved
// one: core's own rendering, placeholders filled and sanitized, so the preview
// is what the recipient gets.
export function useSignOffPreview(html: string) {
  return useQuery({
    queryKey: ["ext", "email-signature", "preview", html],
    enabled: html.trim() !== "",
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const { data, error } = await api.POST("/emails:sign-off", { body: { body: "", draft: { template: html } } });
      if (error) throwProblem(error);
      return data;
    },
  });
}

// The reader's role does not hold ext_email_signature_signature.
export function refusedForRole(error: unknown): boolean {
  if (!(error instanceof ProblemError)) return false;
  const problem = error.problem;
  return typeof problem === "object" && problem !== null && "status" in problem && problem.status === 403;
}
