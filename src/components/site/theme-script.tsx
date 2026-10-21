const initializeTheme = `var storedTheme = window.localStorage.getItem("theme");
var theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
document.documentElement.classList.remove("light", "dark");
document.documentElement.classList.add(theme);
document.documentElement.style.colorScheme = theme;`;

/**
 * Pre-hydration theme bootstrap (avoids a flash of the wrong colour scheme).
 * `nonce` is supplied only on the admin panel, where D6 sends a per-request CSP;
 * the public layout stays static and passes no nonce (so no CSP/dynamic coupling).
 */
export function ThemeScript({ nonce }: Readonly<{ nonce?: string }>) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: initializeTheme }} />;
}
