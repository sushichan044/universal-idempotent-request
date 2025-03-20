/**
 * Check if the value is a non-empty string
 * @param value - The value to check
 * @returns Whether the value is a non-empty string
 */
export const isNonEmptyString = (value?: unknown): value is string => {
  return typeof value === "string" && value !== "";
};
