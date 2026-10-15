const UBB_BASE_URL = 'https://plany.ubb.edu.pl';
const UBB_TIMEOUT_MS = 10_000;

class UBBRequestError extends Error {
  constructor(message, statusCode = 502, cause) {
    super(message, { cause });
    this.statusCode = statusCode;
  }
}

export async function fetchFromUBB(path, options = {}) {
  try {
    const response = await fetch(`${UBB_BASE_URL}${path}`, {
      ...options,
      signal: AbortSignal.timeout(UBB_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new UBBRequestError(`UBB returned HTTP ${response.status}`);
    }
    return response;
  } catch (error) {
    if (error instanceof UBBRequestError) throw error;
    throw new UBBRequestError('Unable to fetch UBB data', error.name === 'TimeoutError' ? 504 : 502, error);
  }
}

export function sendUBBError(response, error, fallbackMessage) {
  // The timeout signal remains active while callers consume the response body.
  const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
  const status = error instanceof UBBRequestError ? error.statusCode : timeout ? 504 : 500;
  response.setHeader('Cache-Control', 'no-store');
  response.status(status).json({
    error: status === 502 || status === 504
      ? 'Serwis planów UBB jest chwilowo niedostępny. Spróbuj ponownie później.'
      : fallbackMessage,
  });
}
