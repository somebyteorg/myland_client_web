import ky from 'ky'
import signStore from '@/stores/sign'
import {LOGIN_URL} from '@/constants'

export {ky}

const instance = ky.create({
    prefixUrl: '/',
    timeout: 1000 * 30,
    retry: 0,
    hooks: {
        beforeRequest: [
            (request) => {
                let token = signStore().user_token

                if (token) {
                    request.headers.set('Authorization', `Bearer ${token}`)
                }
            },
        ],
        afterResponse: [
            async (_request, _options, response) => {
                if (response.status == 401) {
                    await signStore().signOut()
                    window.location.href = LOGIN_URL
                }
            },
        ],
    },
})

export default instance
