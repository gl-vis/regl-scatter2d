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
      range, size, color, borderSize, borderColor,
      positions, count, selection, bounds,
      scale, translate,
      dirty = true,
      charCanvas, charTexture, sizeBuffer, positionBuffer, colorBuffer,
      drawPoints, glyphs


  // regl instance
  if (options.regl) regl = options.regl

  // container/gl/canvas case
  else {
    regl = createRegl({
      pixelRatio: options.pixelRatio || global.devicePixelRatio,
      gl: options.gl,
      container: options.container,
      canvas: options.canvas
    })
  }

  // compatibility
  gl = regl._gl
  canvas = gl.canvas

  //texture for glyphs
  charCanvas = document.createElement('canvas')
  charTexture = regl.texture(charCanvas)

  //buffers to reuse
  sizeBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'float',
    data: null
  })
  positionBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'float',
    data: null
  })
  colorBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'uint8',
    data: null
  })

  //TODO: detect hi-precision here

  update(options)

  drawPoints = regl({
    vert: `
    precision mediump float;

    attribute vec2 position;
    attribute float size;
    attribute vec4 color;

    uniform vec2 scale, translate;
    uniform float borderSize;

    varying vec4 fragColor;
    varying float centerFraction;

    void main() {
      gl_PointSize = size;
      gl_Position = vec4((position * scale + translate) * 2. - 1., 0, 1);

      centerFraction = borderSize == 0. ? 2. : size / (size + borderSize + 1.25);
      fragColor = color;
    }`,

    frag: `
    precision mediump float;
    uniform vec4 borderColor;

    const float fragWeight = 1.0;

    varying vec4 fragColor;
    varying float centerFraction;

    float smoothStep(float x, float y) {
      return 1.0 / (1.0 + exp(50.0*(x - y)));
    }

    void main() {
      float radius = length(2.0*gl_PointCoord.xy-1.0);
      if(radius > 1.0) {
        discard;
      }
      vec4 baseColor = mix(borderColor, fragColor, smoothStep(radius, centerFraction));
      float alpha = 1.0 - pow(1.0 - baseColor.a, fragWeight);
      gl_FragColor = vec4(baseColor.rgb * alpha, alpha);
    }`,

    uniforms: {
      scale: () => scale,
      translate: () => translate,
      borderColor: () => borderColor,
      borderSize: () => borderSize
    },

    attributes: {
      position: positionBuffer,
      size: () => {
        if (Array.isArray(size)) {
          return sizeBuffer
        }
        return {constant: size}
      },
      color: () => {
        if (Array.isArray(color[0])) {
          return colorBuffer
        }
        return {constant: color}
      }
    },

    blend: {
      enable: true,
      equation: {rgb: 'add', alpha: 'add'},
      func: {src: 'one', dst: 'one minus src alpha'}
    },

    count: () => count,

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

    drawPoints()
    dirty = false
  }

  function update (options) {
    if (options.length != null) options = {positions: options}

    //update buffer
    if (options.data) options.positions = options.data
    if (options.points) options.positions = options.points
    if (options.positions) {
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
    if (options.borders) options.border = options.borders
    if (options.border) {
      throw 'unimpl'
      if (Array.isArray(border)) {
        [borderSize, borderColor] = options.border
      }
      else {
        [borderSize, borderColor] = parseBorder(options.border)
      }
    }
    if (options.borderSize != null) {
      borderSize = options.borderSize
    }
    if (options.borderColor != null) {
      borderColor = options.borderColor
    }

    //process colors
    if (options.colors) options.color = options.color
    if (options.color) {
      color = options.color

      //ensure colors are arrays
      if (Array.isArray(color) && (Array.isArray(color[0]) || typeof color[0] === 'string')) {
        for (let i = 0; i < count; i++) {
          if (color[i] != null) {
            color[i] = rgba(color[i])
          }
          else {
            color[i] = 'black'
          }
        }
        colorBuffer(color)
      }
      else if (typeof color === 'string') {
        color = rgba(color)
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

      scale = [
        (bounds[2] - bounds[0]) / (range[2] - range[0]),
        (bounds[3] - bounds[1]) / (range[3] - range[1])
      ]
      translate = [
        (bounds[0] - range[0]) / (range[2] - range[0]),
        (bounds[1] - range[1]) / (range[3] - range[1])
      ]
    }

    //update atlas
    /*
    var maxSize = 0
    for (var i = 0, l = sizes.length; i < l; ++i) {
      if (sizes[i] > maxSize) maxSize = sizes[i]
    }
    var oldStep = this.charStep
    this.charStep = clamp(Math.ceil(maxSize*4), 128, 768)

    var chars = Object.keys(glyphChars)
    var step = this.charStep
    var charSize = Math.floor(step / 2)
    var maxW = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    var maxChars = (maxW / step) * (maxW / step)
    var atlasW = Math.min(maxW, step*chars.length)
    var atlasH = Math.min(maxW, step*Math.ceil(step*chars.length/maxW))
    var cols = Math.floor(atlasW / step)
    if (chars.length > maxChars) {
      console.warn('gl-scatter2d-fancy: number of characters is more than maximum texture size. Try reducing it.')
    }

    //do not overupdate atlas
    if (!this.chars || (this.chars+'' !== chars+'') || this.charStep != oldStep) {
      this.charCanvas = atlas({
        canvas: this.charCanvas,
        family: 'sans-serif',
        size: charSize,
        shape: [atlasW, atlasH],
        step: [step, step],
        chars: chars,
        align: true
      })
      this.chars = chars
    }
    */
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
