'use strict'

const createRegl = require('regl')
const rgba = require('color-rgba')
const getBounds = require('array-bounds')
const clamp = require('clamp')
const colorId = require('color-id')
const snapPoints = require('snap-points-2d')
const normalize = require('array-normalize')
const nextPow2 = require('next-pow-2')
const extend = require('object-assign')
const glslify = require('glslify')
const getSdf = require('./get-sdf')

module.exports = Scatter


function Scatter (options) {
  if (!options) options = {}

  // persistent variables
  let regl, gl, canvas, plot,
      range, elements = [],
      size = 12, maxSize = 12,
      borderSize = 1,
      positions, count, selection, bounds,
      scale, translate,
      drawMarker, drawCircle,
      sizeBuffer, positionBuffer,
      paletteTexture, palette = [], paletteIds = {}, paletteCount = 0,
      colorIdx = 0, colorBuffer,
      borderColorBuffer, borderColorIdx = 1, borderSizeBuffer,
      markerCache = new Map, markerCount = 0, markers

  //FIXME: replace markerCache with plain array - hope there is no that many markers
  //FIXME: normalize marker size

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
  borderSizeBuffer = regl.buffer({
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


  //common shader options
  let shaderOptions = {
    vert: `
    precision mediump float;

    attribute vec2 position;
    attribute float size;
    attribute float borderSize;
    attribute float colorIdx;
    attribute float borderColorIdx;

    uniform vec2 scale, translate;
    uniform float paletteSize, pixelRatio;
    uniform sampler2D palette;

    varying vec4 fragColor, fragBorderColor;
    varying float fragPointSize, fragBorderRadius, fragWidth;

    void main() {
      vec4 color = texture2D(palette, vec2((colorIdx + .5) / paletteSize, 0));
      vec4 borderColor = texture2D(palette, vec2((borderColorIdx + .5) / paletteSize, 0));

      gl_PointSize = (size + borderSize) * pixelRatio;
      fragPointSize = (size + borderSize) * pixelRatio;

      gl_Position = vec4((position * scale + translate) * 2. - 1., 0, 1);

      fragBorderRadius = borderSize == 0. ? 2. : 1. - 2. * borderSize / (size + borderSize);
      fragColor = color;
      fragBorderColor = borderColor;
      fragWidth = 1. / fragPointSize;
    }`,

    frag: null,

    uniforms: {
      pixelRatio: regl.context('pixelRatio'),
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
      color: [0,0,0,1],
      func: {
        srcRGB:   'src alpha',
        srcAlpha: 1,
        dstRGB:   'one minus src alpha',
        dstAlpha: 'one minus src alpha'
      }
    },

    depth: {
      enable: false
    },

    //point ids to render
    elements: regl.prop('elements'),

    primitive: 'points'
  }


  //draw sdf-marker
  let markerOptions = extend({}, shaderOptions)
  markerOptions.uniforms.marker = regl.prop('marker')
  markerOptions.frag = glslify('./marker.frag')

  drawMarker = regl(markerOptions)


  //draw circle
  let circleOptions = extend({}, shaderOptions)
  circleOptions.frag = glslify('./circle.frag')

  drawCircle = regl(circleOptions)


  //main draw method
  function draw (opts) {
    if (opts) update(opts)

    if (!count) return

    //draw all available markers
    markerCache.forEach((markerObj, marker) => {
      let {texture, ids, size} = markerObj

      if (texture) {
        drawMarker({elements: ids, marker: texture})
      } else {
        drawCircle({elements: ids})
      }
    })
  }

  function update (options) {
    if (options.length != null) options = {positions: options}

    //update buffer
    if (options.data) options.positions = options.data
    if (options.points) options.positions = options.points
    if (options.positions && options.positions.length) {
      //unroll positions
      let unrolled
      if (options.positions[0].length) {
        unrolled = Array(options.positions.length)
        for (let i = 0, l = options.positions.length; i<l; i++) {
          unrolled[i*2] = options.positions[i][0]
          unrolled[i*2+1] = options.positions[i][1]
        }
      }
      else {
        unrolled = options.positions.slice()
      }

      bounds = getBounds(unrolled, 2)
      positions = normalize(unrolled, 2, bounds)
      positionBuffer(positions)
      count = Math.floor(positions.length / 2)

      //update elements ids - that is all points
      elements = Array(count)
      for (let i = 0; i < count; i++) {
        elements[i] = i
      }
    }

    //sizes
    if (options.sizes) options.size = options.sizes
    if (options.size != null) {
      size = options.size
      if (Array.isArray(size)) {
        sizeBuffer(size)

        maxSize = size[0]
        for (let i = 0, l = size.length; i < l; i++) {
          if (size[i] > maxSize) maxSize = size[i]
        }
      }
      else {
        maxSize = size
      }
    }

    //take over borders
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

    //aggregate markers sdf
    if (options.markers) options.marker = options.markers
    if (options.marker !== undefined) {
      //reset marker elements
      markerCache.forEach((markerObj, marker) => {
        markerObj.ids = []
      })

      if (Array.isArray(options.marker)) {
        for (let i = 0, l = options.marker.length; i < l; i++) {
          updateMarker(options.marker[i], i, Array.isArray(size) ? size[i] : size)
        }
      }
      else {
        updateMarker(options.marker, elements, maxSize)
      }

      markers = options.marker
    }
    else if (markers === undefined) {
      markers = null
      updateMarker(markers, elements, maxSize)
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
        color = [127, 127, 127, 127]
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

  //update marker sdf
  function updateMarker(marker, id, size) {
    let markerObj

    size = nextPow2(size)

    if (markerCache.has(marker)) {
      markerObj = markerCache.get(marker)
    }
    else {
      markerObj = {ids: [], data: null, size: 0}
      markerCache.set(marker, markerObj)
    }

    //generate sdf bitmap of proper size
    if (marker != null && markerObj.size < size) {
      let distArr = getSdf(marker, size)
      for (let i = 0, l = distArr.length; i < l; i++) {
        distArr[i] *= 255
      }

      markerObj.texture = regl.texture({
        channels: 1,
        data: new Uint8Array(distArr),
        radius: size * 4
      })
      markerObj.size = size
    }

    if (Array.isArray(id)) {
      markerObj.ids = id
    }
    else {
      markerObj.ids.push(id)
    }

    return markerObj
  }

  return draw
}
