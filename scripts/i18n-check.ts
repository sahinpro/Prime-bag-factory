import bn from "../src/messages/bn.json";
import en from "../src/messages/en.json";

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return flatten(child, next);
  });
}

const enKeys = new Set(flatten(en));
const bnKeys = new Set(flatten(bn));
const missingInBn = [...enKeys].filter((key) => !bnKeys.has(key));
const missingInEn = [...bnKeys].filter((key) => !enKeys.has(key));

if (missingInBn.length > 0 || missingInEn.length > 0) {
  console.error(
    JSON.stringify({ missingInBn, missingInEn }, null, 2),
  );
  process.exit(1);
}

console.log(`i18n: ${enKeys.size} keys match in en and bn`);
