import type {Container, Renderer} from 'pixi.js'
import type {PixiDrawContext} from './pixiDrawContext'

export interface PixiMapRenderLayers {
    stage: Container
    backdrop: Container
    static: Container
    scene: Container
    cropAnimation: Container
    objectAnimation: Container
    overlayAnimation: Container
    labels: Container
}

export interface PixiMapRenderFrame {
    backdropContext: PixiDrawContext
    cropAnimationContext: PixiDrawContext
    labelContext: PixiDrawContext
    objectAnimationContext: PixiDrawContext
    overlayAnimationContext: PixiDrawContext
    renderer: Renderer
    sceneContext: PixiDrawContext
    layers: PixiMapRenderLayers
}
