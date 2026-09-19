import { Application, Sprite, Texture } from 'pixi.js'
import { atlasTexture } from '../src/render/textures/SpriteAtlas.js'

/** Comparación en GPU con la misma imagen sin atlas, incluidos bordes, alfa y rotación. */
export async function checkAtlas() {
  const app = new Application()
  await app.init({ width: 32, height: 32, autoStart: false, antialias: true })
  const results: { size: number; scale: number; rotation: number; maxChannelDifference: number }[] = []
  try {
    for (const size of [16, 257, 513]) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const context = canvas.getContext('2d')!
      context.fillStyle = '#ff3000'
      context.fillRect(0, 0, size, size)
      context.fillStyle = 'rgba(0, 255, 120, 0.5)'
      context.clearRect(0, 0, size / 2, size / 2)
      context.fillRect(0, 0, size / 2, size / 2)
      context.fillStyle = '#3040ff'
      context.fillRect(size / 2, size / 2, size / 2, size / 2)
      const reference = new Sprite(Texture.from(canvas))
      const copy = document.createElement('canvas')
      copy.width = copy.height = size
      copy.getContext('2d')!.drawImage(canvas, 0, 0)
      const packed = new Sprite(atlasTexture(Texture.from(copy)))
      for (const [scale, rotation] of [
        [1, 0],
        [0.35, 0.7],
        [1.5, 1.3],
      ]) {
        reference.scale.set(scale)
        packed.scale.set(scale)
        reference.rotation = packed.rotation = rotation
        const expected = app.renderer.extract.pixels(reference)
        const actual = app.renderer.extract.pixels(packed)
        if (actual.width !== expected.width || actual.height !== expected.height)
          throw new Error('Atlas changed the sprite bounds')
        let maxChannelDifference = 0
        for (let i = 0; i < expected.pixels.length; i++)
          maxChannelDifference = Math.max(
            maxChannelDifference,
            Math.abs(expected.pixels[i] - actual.pixels[i]),
          )
        results.push({ size, scale, rotation, maxChannelDifference })
        if (maxChannelDifference > 2)
          throw new Error(`Atlas changed pixels: ${JSON.stringify(results.at(-1))}`)
      }
      reference.destroy({ texture: true, textureSource: true })
      packed.destroy() // Las páginas se comparten con los demás sprites de la aplicación.
    }
    return results
  } finally {
    app.destroy(true)
  }
}
