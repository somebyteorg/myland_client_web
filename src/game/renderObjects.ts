import {tileSize} from './config'
import {getThemeStrokeColor, getThemeStructureColor, hexToRgba, mixHexColor, resolveThemeColor} from './colorUtils'
import type {MapObject} from './types'
import type {PixiDrawContext} from './pixiDrawContext'

export function drawHomeObject(context: PixiDrawContext, object: MapObject, timestamp = 0) {
    const left = object.x * tileSize
    const top = object.y * tileSize
    const width = object.width * tileSize
    const height = object.height * tileSize
    const levelRatio = (object.level - 1) / 4
    const wallInset = 18 - levelRatio * 6
    const wallTop = top + 46 - levelRatio * 9
    const wallHeight = 54 + levelRatio * 10
    const pulse = Math.sin(timestamp / 420 + object.level) * 1.5
    const themeColor = resolveThemeColor(object.ownerData?.color)
    const strokeColor = getThemeStrokeColor(themeColor)
    const structureColor = getThemeStructureColor(themeColor)
    const roofColor = object.level >= 4 ? mixHexColor(themeColor, structureColor, 0.22) : mixHexColor(themeColor, structureColor, 0.14)
    const wallColor = mixHexColor(themeColor, '#fff7df', 0.42)

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.fillStyle = hexToRgba(themeColor, 0.2)
    context.beginPath()
    context.ellipse(left + width / 2, top + height - 12, 48 + levelRatio * 10, 11, 0, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = hexToRgba(strokeColor, 0.22)
    context.fillRect(left + wallInset - 2, wallTop + pulse + 2, width - wallInset * 2 + 4, wallHeight + 2)
    context.fillStyle = wallColor
    context.fillRect(left + wallInset, wallTop + pulse, width - wallInset * 2, wallHeight)
    context.strokeStyle = hexToRgba(strokeColor, 0.9)
    context.lineWidth = 3
    context.strokeRect(left + wallInset, wallTop + pulse, width - wallInset * 2, wallHeight)

    const roofTop = top + 18 - levelRatio * 6 + pulse
    context.strokeStyle = hexToRgba(strokeColor, 0.32)
    context.lineWidth = 7
    context.beginPath()
    context.moveTo(left + 8, wallTop + 8 + pulse)
    context.lineTo(left + width / 2, roofTop)
    context.lineTo(left + width - 8, wallTop + 8 + pulse)
    context.stroke()
    context.fillStyle = roofColor
    triangle(context, left + 8, wallTop + 8 + pulse, left + width / 2, roofTop, left + width - 8, wallTop + 8 + pulse)

    context.strokeStyle = hexToRgba(structureColor, 0.94)
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(left + 8, wallTop + 8 + pulse)
    context.lineTo(left + width / 2, roofTop)
    context.lineTo(left + width - 8, wallTop + 8 + pulse)
    context.stroke()

    context.strokeStyle = hexToRgba(structureColor, 0.72)
    context.lineWidth = 3
    context.beginPath()
    context.moveTo(left + wallInset + 8, wallTop + 20 + pulse)
    context.lineTo(left + width - wallInset - 8, wallTop + 20 + pulse)
    context.stroke()

    context.fillStyle = structureColor
    context.fillRect(left + width / 2 - 9, wallTop + 30 + pulse, 18, wallHeight - 30)
    context.fillStyle = hexToRgba('#fff7df', 0.18)
    context.fillRect(left + width / 2 - 5, wallTop + 33 + pulse, 3, wallHeight - 36)
    context.fillStyle = '#fff4bd'
    context.fillRect(left + 33, wallTop + 19 + pulse, 15, 14)
    context.fillRect(left + width - 48, wallTop + 19 + pulse, 15, 14)
    context.strokeStyle = hexToRgba(structureColor, 0.88)
    context.lineWidth = 2
    context.strokeRect(left + 33, wallTop + 19 + pulse, 15, 14)
    context.strokeRect(left + width - 48, wallTop + 19 + pulse, 15, 14)

    if (object.level >= 3) {
        context.strokeStyle = '#6c8f52'
        context.lineWidth = 4
        context.beginPath()
        context.moveTo(left + 14, top + height - 24)
        context.quadraticCurveTo(left + width / 2, top + height - 36, left + width - 14, top + height - 24)
        context.stroke()
    }

    drawLevelBadge(context, object.level, left + width - 24, top + 20)
    drawHomeSmoke(context, left + width - 30, roofTop + 8, timestamp, object.level)
    context.restore()
}

export function drawHomeSmoke(context: PixiDrawContext, x: number, y: number, timestamp: number, level: number) {
    if (level < 2) return

    const time = timestamp / 1000
    context.fillStyle = 'rgba(255, 248, 220, 0.38)'

    for (let i = 0; i < Math.min(4, level); i += 1) {
        const drift = (time * 12 + i * 13) % 36
        context.beginPath()
        context.arc(x + Math.sin(time + i) * 5, y - drift, 5 + i * 1.2, 0, Math.PI * 2)
        context.fill()
    }
}

export function drawWatchdogObject(context: PixiDrawContext, object: MapObject, timestamp: number) {
    const position = getWatchdogPosition(object)
    const x = position.x
    const y = position.y
    const bounce = Math.sin(timestamp / 280) * 1.4

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.fillStyle = 'rgba(64, 39, 24, 0.22)'
    context.beginPath()
    context.ellipse(x + 1, y + 8 + bounce, 17, 5, 0, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = '#4a2d1c'
    context.lineWidth = 2
    context.fillStyle = '#68412a'
    context.beginPath()
    context.ellipse(x, y + bounce, 11, 7, 0, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.beginPath()
    context.arc(x + 9, y - 3 + bounce, 6, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.strokeStyle = '#4a2d1c'
    context.lineWidth = 3
    context.beginPath()
    context.moveTo(x - 10, y - 3 + bounce)
    context.quadraticCurveTo(x - 18, y - 12, x - 22, y - 4)
    context.stroke()
    context.fillStyle = '#f2d58a'
    context.beginPath()
    context.arc(x + 11, y - 5 + bounce, 1.5, 0, Math.PI * 2)
    context.fill()

    if (object.state === 'alert') {
        context.strokeStyle = 'rgba(196, 77, 63, 0.62)'
        context.lineWidth = 2
        for (let i = 0; i < 3; i += 1) {
            context.beginPath()
            context.arc(x + 18, y - 9 + bounce, 8 + i * 6 + Math.sin(timestamp / 180) * 2, -0.6, 0.6)
            context.stroke()
        }
    }

    drawLevelBadge(context, object.level, x + 13, y - 21)
    context.restore()
}

export function getWatchdogPosition(object: MapObject) {
    return {
        x: (object.x + 0.38) * tileSize,
        y: (object.y + 0.68) * tileSize,
    }
}

export function drawScarecrowObject(context: PixiDrawContext, object: MapObject, timestamp: number) {
    const centerX = (object.x + 0.5) * tileSize
    const baseY = (object.y + 0.82) * tileSize
    const sway = Math.sin(timestamp / 360 + object.level) * (4 + object.level)

    context.save()
    context.translate(centerX, baseY)
    context.rotate((sway * Math.PI) / 360)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = 'rgba(71, 48, 25, 0.32)'
    context.lineWidth = 7
    context.beginPath()
    context.moveTo(0, 0)
    context.lineTo(0, -42)
    context.moveTo(-22, -29)
    context.lineTo(22, -29)
    context.stroke()
    context.strokeStyle = '#6d4a25'
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(0, 0)
    context.lineTo(0, -42)
    context.moveTo(-22, -29)
    context.lineTo(22, -29)
    context.stroke()

    context.fillStyle = object.level >= 4 ? '#d25f47' : '#caa052'
    context.fillRect(-17, -29, 34, 22)
    context.strokeStyle = 'rgba(89, 57, 25, 0.42)'
    context.lineWidth = 1.6
    context.strokeRect(-17, -29, 34, 22)
    context.fillStyle = '#7b4a26'
    triangle(context, -18, -46, 0, -58, 18, -46)
    context.strokeStyle = 'rgba(70, 45, 22, 0.42)'
    context.lineWidth = 1.4
    context.beginPath()
    context.moveTo(-18, -46)
    context.lineTo(0, -58)
    context.lineTo(18, -46)
    context.stroke()
    context.fillStyle = '#e4c986'
    context.beginPath()
    context.arc(0, -39, 9, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = 'rgba(91, 63, 28, 0.34)'
    context.lineWidth = 1
    context.stroke()

    context.strokeStyle = 'rgba(255, 232, 111, 0.45)'
    context.lineWidth = 2
    context.beginPath()
    context.arc(0, -28, 23 + object.level * 2 + Math.sin(timestamp / 260) * 2, 0.2, Math.PI - 0.2)
    context.stroke()
    context.restore()

    drawLevelBadge(context, object.level, centerX + 18, baseY - 58)
}

export function drawLevelBadge(context: PixiDrawContext, level: number, x: number, y: number) {
    context.fillStyle = 'rgba(60, 49, 32, 0.78)'
    context.beginPath()
    context.roundRect(x - 12, y - 8, 24, 16, 5)
    context.fill()
    context.fillStyle = '#fff2a7'
    context.font = '800 10px sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(`L${level}`, x, y)
    context.textAlign = 'start'
    context.textBaseline = 'alphabetic'
}

function triangle(context: PixiDrawContext, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
    context.beginPath()
    context.moveTo(ax, ay)
    context.lineTo(bx, by)
    context.lineTo(cx, cy)
    context.closePath()
    context.fill()
}
