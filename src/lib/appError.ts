const technicalDatabasePattern =
  /\b(column|relation|table|schema|sqlstate|operator|constraint|policy|rls|row-level security|postgrest|pgrst|function .* does not exist|permission denied|duplicate key|violates .* constraint)\b/i;

function errorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return null;
}

/**
 * Keeps deliberate business-rule messages while preventing database schema,
 * policy, and SQL diagnostics from appearing in the user interface.
 */
export function toAppError(error: unknown, fallbackMessage: string): Error {
  const message = errorMessage(error);

  if (import.meta.env.DEV) {
    console.error(fallbackMessage, error);
  }

  if (message && !technicalDatabasePattern.test(message)) {
    return new Error(message);
  }

  return new Error(fallbackMessage);
}
