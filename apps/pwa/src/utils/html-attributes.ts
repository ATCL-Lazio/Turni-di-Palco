type AttributeOptions = {
  keyPrefix?: string;
};

export function buildAttributeString(attributes?: Record<string, string>, options: AttributeOptions = {}) {
  if (!attributes) return "";
  const { keyPrefix = "" } = options;

  return Object.entries(attributes)
    .map(([key, value]) => ` ${keyPrefix}${key}="${value}"`)
    .join("");
}
