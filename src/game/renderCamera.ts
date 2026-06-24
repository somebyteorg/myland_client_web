import type {CameraState} from './mapCamera'

export const highDetailStaticScale = 1

export function getCameraDrawOffset(camera: CameraState) {
    if (camera.scale < highDetailStaticScale) {
        return {
            x: camera.x,
            y: camera.y,
        }
    }

    return {
        x: Math.round(camera.x),
        y: Math.round(camera.y),
    }
}
