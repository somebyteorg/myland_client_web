import api from '@/utils/ky'

export interface UploadFileResponse {
    path: string
    url: string
}

export interface UploadFileOptions {
    filename?: string
}

export function uploadFile(file: Blob | File, options: UploadFileOptions = {}) {
    const formData = new FormData()
    const uploadFile = file instanceof File
        ? file
        : new File([file], options.filename || `upload-${Date.now()}`, {
            type: file.type || 'application/octet-stream',
        })

    formData.set('file', uploadFile)

    return api.post('api/upload', {
        body: formData,
    }).json<UploadFileResponse>()
}
