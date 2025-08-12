import { z } from "zod";

/**
 * Safe validation that returns either success with data or error with message
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((e: any) => `${e.path?.join(".") || "root"}: ${e.message}`)
        .join(", ");
      return { success: false, error: errorMessages };
    }
    return { success: false, error: "Validation failed" };
  }
}

/**
 * Partial validation for updates (makes all fields optional)
 */
export function validatePartial<T>(
  schema: z.ZodObject<any>,
  data: unknown
): { success: true; data: Partial<T> } | { success: false; error: string } {
  const partialSchema = schema.partial();
  return safeValidate(partialSchema as z.ZodSchema<Partial<T>>, data);
}

/**
 * Validate and sanitize user input
 */
export function sanitizeString(input: string, maxLength: number = 100): string {
  return input.trim().slice(0, maxLength);
}

/**
 * Validate game code format
 */
export function isValidGameCode(code: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuid
  );
}

/**
 * Validate admin token format
 */
export function isValidAdminToken(token: string): boolean {
  return /^[a-z0-9]{32}$/.test(token);
}