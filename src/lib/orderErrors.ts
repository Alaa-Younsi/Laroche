import type { TranslationKey } from "@/i18n/translations";

const ERROR_MAP: Record<string, TranslationKey> = {
  ERR_CART_EMPTY: "errorCartEmpty",
  ERR_PRODUCT_UNAVAILABLE: "errorProductUnavailable",
  ERR_STOCK: "errorStock",
  ERR_WILAYA_DISABLED: "errorWilayaDisabled",
  ERR_INVALID_INPUT: "errorInvalidInput",
  ERR_RATE_LIMIT: "errorRateLimit",
};

export function orderErrorKey(message: string): TranslationKey {
  for (const code of Object.keys(ERROR_MAP)) {
    if (message.includes(code)) return ERROR_MAP[code];
  }
  return "errorGeneric";
}
