const initializeTheme = `var storedTheme = window.localStorage.getItem("theme");
var theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
document.documentElement.classList.remove("light", "dark");
document.documentElement.classList.add(theme);
document.documentElement.style.colorScheme = theme;`;

export function ThemeScript() {
  return (
    <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
  );
}
