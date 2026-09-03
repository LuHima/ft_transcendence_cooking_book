import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

export function useRecipeTexture(title: string, isBack = false) {
	return useMemo(() => {
		const canvas = document.createElement('canvas')
		canvas.width = 512
		canvas.height = 384
		const ctx = canvas.getContext('2d')!

		ctx.fillStyle = '#f5e6c8'
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		ctx.fillStyle = '#3d1f10'
		ctx.font = 'italic bold 32px "Playfair Display", serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(isBack ? '' : title, canvas.width / 2, canvas.height / 2)

		const texture = new CanvasTexture(canvas)
		texture.colorSpace = SRGBColorSpace
		return texture
	}, [title, isBack])
}