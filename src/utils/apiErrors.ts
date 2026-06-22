export interface ResolvedApiError {
    message: string
    status: number | null
    isValidationError: boolean
}

export async function resolveApiError(error: unknown, fallback: string): Promise<ResolvedApiError> {
    const response = getErrorResponse(error)
    if (!response) {
        return {
            message: fallback,
            status: null,
            isValidationError: false,
        }
    }

    const payload = await response.clone().json().catch(() => null)
    if (response.status === 422) {
        return {
            message: extractValidationErrorMessage(payload) || fallback,
            status: 422,
            isValidationError: true,
        }
    }

    return {
        message: extractErrorMessage(payload) || fallback,
        status: response.status,
        isValidationError: false,
    }
}

export async function resolveApiErrorMessage(error: unknown, fallback: string) {
    return (await resolveApiError(error, fallback)).message
}

function getErrorResponse(error: unknown) {
    if (!error || typeof error !== 'object') return null

    const response = (error as { response?: unknown }).response

    return response instanceof Response ? response : null
}

function extractValidationErrorMessage(payload: unknown): string {
    if (typeof payload === 'string') return payload.trim()
    if (!payload || typeof payload !== 'object') return ''

    const message = (payload as { message?: unknown }).message

    return typeof message === 'string' ? message.trim() : ''
}

function extractErrorMessage(payload: unknown): string {
    if (typeof payload === 'string') return payload
    if (Array.isArray(payload)) return payload.map(extractErrorMessage).filter(Boolean).join('；')
    if (!payload || typeof payload !== 'object') return ''

    const record = payload as Record<string, unknown>
    for (const key of ['message', 'error', 'msg']) {
        const message = extractErrorMessage(record[key])
        if (message) return message
    }

    const detailMessage = extractErrorMessage(record.detail)
    if (detailMessage) return detailMessage

    const errorsMessage = extractErrorMessage(record.errors)
    if (errorsMessage) return errorsMessage

    return Object.values(record).map(extractErrorMessage).filter(Boolean).join('；')
}
