import { isMissingSupabaseSessionError } from "./evaluationProfile";

/** A stored demo may only be restored after the server has confirmed there is no signed-in account. */
export async function resolveInitialProfileMode<T>(getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>, readDemo: () => T | null) {
  const { data, error } = await getUser();
  if (error && !isMissingSupabaseSessionError(error)) throw Error("No se pudo verificar la sesión para cargar tus datos.");
  if (data.user) return { mode: "account" as const, userId: data.user.id };
  const demo = readDemo();
  return demo ? { mode: "demo" as const, demo } : { mode: "anonymous" as const };
}
