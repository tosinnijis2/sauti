// Allow only destinations used by the favorites sign-in flow.
export function safeAuthReturn(value: unknown) {
  return typeof value === "string" && (/^(\/market\/[a-zA-Z0-9-]{1,100}|\/saved|\/dashboard)$/.test(value) || /^\/verify-email\?token=[a-f0-9]{64}$/.test(value)) ? value : "/dashboard";
}

export function favoriteSignInPath(productId: string) {
  return "/login?" + new URLSearchParams({ next: `/market/${productId}`, notice: "save" });
}
