const ADMIN_LOGIN_PATH = "/admin/login";

export function getSafeAdminRedirectPath(path: string | undefined): string {
  if (!path) {
    return "/admin";
  }

  const target = new URL(path, "https://prime-bag-factory.invalid");
  if (
    target.origin !== "https://prime-bag-factory.invalid" ||
    (target.pathname !== "/admin" && !target.pathname.startsWith("/admin/")) ||
    target.pathname === ADMIN_LOGIN_PATH ||
    target.pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)
  ) {
    return "/admin";
  }

  return `${target.pathname}${target.search}${target.hash}`;
}
