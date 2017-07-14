'use strict'

const createRegl = require('regl')
const extend = require('object-assign')
const rgba = require('color-rgba')
const getBounds = require('array-bounds')
const clamp = require('clamp')
const atlas = require('font-atlas-sdf')
const colorId = require('color-id')
const snapPoints = require('snap-points-2d')
const normalize = require('array-normalize')

module.exports = Scatter

function Scatter (options) {
  if (!options) options = {}

  // persistent variables
  let regl, gl, canvas, plot,
      range,
      size = 5,
      borderSize = 1,
      positions, count, selection, bounds,
      scale, translate,
      dirty = true,
      charCanvas, charTexture, sizeBuffer, positionBuffer,
      paletteTexture, palette = [], paletteIds = {}, paletteCount = 0,
      colorIdx = 0, colorBuffer,
      borderColorBuffer, borderColorIdx = 1,
      drawPoints, glyphs


  // regl instance
  if (options.regl) regl = options.regl

  // container/gl/canvas case
  else {
    let opts = {}
    opts.pixelRatio = options.pixelRatio || global.devicePixelRatio
    if (options.canvas) opts.canvas = options.canvas
    if (options.container) opts.container = options.container
    if (options.gl) opts.gl = options.gl
    regl = createRegl(opts)
  }

  // compatibility
  gl = regl._gl
  canvas = gl.canvas

  //texture for glyphs
  charCanvas = document.createElement('canvas')
  charTexture = regl.texture(charCanvas)

  //texture with color palette
  paletteTexture = regl.texture({
    type: 'uint8',
    format: 'rgba'
  })

  //buffers to reuse
  sizeBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'float',
    data: null
  })
  colorBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'uint16',
    data: null
  })
  borderColorBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'uint16',
    data: null
  })
  positionBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'float',
    data: null
  })

  //TODO: detect hi-precision here

  update(options)

  drawPoints = regl({
    vert: `
    precision mediump float;

    attribute vec2 position;
    attribute float size;
    attribute float borderSize;
    attribute float colorIdx;
    attribute float borderColorIdx;

    uniform vec2 scale, translate;
    uniform float paletteSize;
    uniform sampler2D palette;

    varying vec4 fragColor, fragBorderColor;
    varying float centerFraction;

    void main() {
      vec4 color = texture2D(palette, vec2((colorIdx + .5) / paletteSize, 0));
      vec4 borderColor = texture2D(palette, vec2((borderColorIdx + .5) / paletteSize, 0));

      gl_PointSize = size;
      gl_Position = vec4((position * scale + translate) * 2. - 1., 0, 1);

      centerFraction = borderSize == 0. ? 2. : size / (size + borderSize + 1.25);
      fragColor = color;
      fragBorderColor = borderColor;
    }`,

    frag: `
    precision mediump float;

    const float fragWeight = 1.0;

    varying vec4 fragColor, fragBorderColor;
    varying float centerFraction;

    float smoothStep(float x, float y) {
      return 1.0 / (1.0 + exp(50.0*(x - y)));
    }

    void main() {
      float radius = length(2.0*gl_PointCoord.xy-1.0);
      if(radius > 1.0) {
        discard;
      }
      vec4 baseColor = mix(fragBorderColor, fragColor, smoothStep(radius, centerFraction));
      float alpha = 1.0 - pow(1.0 - baseColor.a, fragWeight);
      gl_FragColor = vec4(baseColor.rgb * alpha, alpha);
    }`,

    uniforms: {
      palette: paletteTexture,
      paletteSize: () => palette.length/4,
      scale: () => scale,
      translate: () => translate
    },

    attributes: {
      position: positionBuffer,
      size: () => {
        if (Array.isArray(size)) {
          return sizeBuffer
        }
        return {constant: size}
      },
      borderSize: () => {
        if (Array.isArray(borderSize)) {
          return borderSizeBuffer
        }
        return {constant: borderSize}
      },
      colorIdx: () => {
        if (Array.isArray(colorIdx)) {
          return colorBuffer
        }
        return {constant: colorIdx}
      },
      borderColorIdx: () => {
        if (Array.isArray(borderColorIdx)) {
          return borderColorBuffer
        }
        return {constant: borderColorIdx}
      }
    },

    blend: {
      enable: true,
      func: {
        srcRGB:   'src alpha',
        srcAlpha: 'src alpha',
        dstRGB:   'one minus src alpha',
        dstAlpha: 'one minus src alpha'
      }
    },

    depth: {
      enable: false
    },
    count: () => count || 0,

    // and same for the selection
    // elements: [0,1],

    primitive: 'points'
  })

  //clean dirty flag every frame
  regl.frame(ctx => {
    dirty = true
  })

  //main draw method
  function draw (opts) {
    if (opts) update(opts)

    if (!dirty) return

    if (!count) return

    drawPoints()
    dirty = false
  }

  function update (options) {
    if (options.length != null) options = {positions: options}

    //update buffer
    if (options.data) options.positions = options.data
    if (options.points) options.positions = options.points
    if (options.positions && options.positions.length) {
      bounds = getBounds(options.positions, 2)
      positions = normalize(options.positions.slice(), 2, bounds)
      positionBuffer(positions)
      count = Math.floor(positions.length / 2)
    }

    //sizes
    if (options.sizes) options.size = options.sizes
    if (options.size != null) {
      size = options.size
      if (Array.isArray(size)) {
        sizeBuffer(size)
      }
    }

    //take over borders
    // if (options.borders) options.border = options.borders
    // if (options.border) {
    //   throw 'unimpl'
    //   if (Array.isArray(border)) {
    //     [borderSize, borderColor] = options.border
    //   }
    //   else {
    //     [borderSize, borderColor] = parseBorder(options.border)
    //   }
    // }
    if (options.borderSizes) options.borderSize = options.borderSizes
    if (options.borderSize != null) {
      borderSize = options.borderSize
      if (Array.isArray(borderSize)) {
        borderSizeBuffer(borderSize)
      }
    }

    //process colors
    if (options.colors) options.color = options.colors
    if (options.borderColors) options.borderColor = options.borderColors

    if (options.color || options.borderColor || options.palette) {
      //reset palette if passed
      if (options.palette) {
        palette = [], paletteIds = {}, paletteCount = 0
        for (let i = 0, l = options.palette.length; i < l; i++) {
          let color = rgba(options.palette[i], false)
          color[3] *= 255.
          let id = colorId(color, false)
          paletteIds[id] = paletteCount
          paletteCount++
          palette[i*4] = color[0]
          palette[i*4+1] = color[1]
          palette[i*4+2] = color[2]
          palette[i*4+3] = color[3]
        }
      }

      //augment palette, bring colors to indexes
      if (options.color) {
        colorIdx = updateColor(options.color)
        if (Array.isArray(colorIdx) && colorIdx.length) {
          colorBuffer(colorIdx)
        }
      }
      if (options.borderColor) {
        borderColorIdx = updateColor(options.borderColor)
        if (Array.isArray(borderColorIdx)) borderColorBuffer(borderColorIdx)
      }

      if (palette.length) {
        if (palette.length >= 8192*4) {
          console.warn('regl-scatter2d: too many colors. Palette will be clipped.')
          palette = palette.slice(0, 8192*4)
        }

        paletteTexture({
          width: palette.length/4,
          height: 1,
          data: palette
        })
      }
    }

    //aggregate glyphs
    if (options.glyphs) options.glyph = options.glyphs
    if (options.glyph != null) {
      // var glyphChars = {}
      // for (var i = 0, l = this.pointCount, k = 0; i < l; i++) {
      //   var char = glyphs[i]
      //   if (glyphChars[char] == null) {
      //     glyphChars[char] = k++
      //   }
      // }
    }

    //make sure scale/translate are properly set
    if (!options.range && !range) options.range = bounds
    if (options.range) {
      range = options.range
      let xrange = range[2] - range[0]
      let yrange = range[3] - range[1]

      scale = [
        (bounds[2] - bounds[0]) / xrange,
        (bounds[3] - bounds[1]) / yrange
      ]
      translate = [
        (bounds[0] - range[0]) / xrange,
        (bounds[1] - range[1]) / yrange
      ]
    }
  }

  //update borderColor or color
  function updateColor(colors) {
    if (!Array.isArray(colors)) {
      colors = [colors]
    }

    if (colors.length > 1 && colors.length != count) throw Error('Not enough colors')

    let idx = []
    for (let i = 0; i < colors.length; i++) {
      let color = colors[i]

      //idx colors
      if (typeof color === 'number') {
        idx[i] = color
        continue
      }

      if (typeof color === 'string') {
        color = rgba(color, false)
        color[3] *= 255;
        color = color.map(Math.floor)
      }
      else if (Array.isArray(color)) {
        color = color.map(Math.floor)
      }
      else {
        color = [128, 128, 128, 1]
      }

      let id = colorId(color, false)
      if (paletteIds[id] == null) {
        palette[paletteCount*4] = color[0]
        palette[paletteCount*4+1] = color[1]
        palette[paletteCount*4+2] = color[2]
        palette[paletteCount*4+3] = color[3]
        paletteIds[id] = paletteCount
        paletteCount++
      }
      idx[i] = paletteIds[id]
    }

    //keep static index for single-color property
    return idx.length === 1 ? idx[0] : idx
  }

  return draw
}




/*
// adjust scale and transform so to see all the data
Scatter.prototype.autorange = function (positions) {
  if (!positions) positions = this.positions
  if (!positions || positions.length == 0) return this;

  let bounds = this.bounds

  let scale = [1 / (bounds[2] - bounds[0]), 1 / (bounds[3] - bounds[1])]

  this.update({
    scale: scale,
    translate: [-bounds[0], -bounds[1]],
  })

  return this
}

Scatter.prototype.clear = function () {
  this.regl.clear({
    color: [1,1,1,1],
    depth: 1,
    stencil: 0
  })

  return this
}

Scatter.prototype.pick = function (x, y, value) {
  // return this.draw()
  return null
}


Scatter.prototype.drawPick = function () {
  return this.pointCount
}

Scatter.prototype.dispose = function () {
  this.charTexture.destroy()
  this.sizeBuffer.destroy()
  this.positionBuffer.destroy()

  if (this.plot) this.plot.removeObject(this)

  return this
}

Scatter.prototype.select = function () {
  //TODO: init regl draw here
  return this
}

*/
