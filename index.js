'use strict'

const createRegl = require('regl')
const rgba = require('color-rgba')
const getBounds = require('array-bounds')
const colorId = require('color-id')
const snapPoints = require('../snap-points-2d')
const extend = require('object-assign')
const glslify = require('glslify')
const search = require('binary-search-bounds')

module.exports = Scatter


function Scatter (options) {
  if (!options) options = {}
  else if (typeof options === 'function') options = {regl: options}
  else if (options.length) options = {positions: options}

  // persistent variables
  let regl,
      range, scale, translate, scaleFract, translateFract, elements = [],
      size, maxSize = 0, minSize = 0,
      borderSize = 1,
      positions, count = 0, bounds,
      pixelSize,
      drawMarker, drawCircle,
      sizeBuffer, positionBuffer,
      paletteTexture, palette = [], paletteIds = {}, paletteCount = 0,
      colorIdx, colorBuffer,
      borderColorBuffer, borderColorIdx, borderSizeBuffer,
      markerIds = [], markerKey = [], markers,
      snap = 1e4, hiprecision = true,
      viewport

  // regl instance
  if (options.regl) regl = options.regl

  // container/gl/canvas case
  else {
    let opts = {}
    opts.pixelRatio = options.pixelRatio || global.devicePixelRatio

    if (options instanceof HTMLCanvasElement) opts.canvas = options
    else if (options instanceof HTMLElement) opts.container = options
    else if (options.drawingBufferWidth || options.drawingBufferHeight) opts.gl = options
    else {
      if (options.canvas) opts.canvas = options.canvas
      if (options.container) opts.container = options.container
      if (options.gl) opts.gl = options.gl
    }

    opts.optionalExtensions = [
      'OES_element_index_uint'
    ]

    //FIXME: fallback to Int16Array if extension is not supported
    regl = createRegl(opts)
  }

  //texture with color palette
  paletteTexture = regl.texture({
    type: 'uint8',
    format: 'rgba',
    mag: 'nearest',
    min: 'nearest'
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

  //update with defaults
  update(extend({
    color: 'black',
    borderColor: 'transparent',
    borderSize: 1,
    size: 12,
    marker: null
  }, options))


  //common shader options
  let shaderOptions = {
    uniforms: {
      pixelRatio: regl.context('pixelRatio'),
      palette: paletteTexture,
      paletteSize: () => palette.length * .25,
      scale: () => scale,
      scaleFract: () => scaleFract,
      translate: () => translate,
      translateFract: () => translateFract
    },

    attributes: {
      position: () => {
        return hiprecision ? {
          buffer: positionBuffer,
          offset: 0,
          stride: 16
        } : positionBuffer
      },
      positionFract: () => {
        return hiprecision ? {
          buffer: positionBuffer,
          offset: 8,
          stride: 16
        } : {
          constant: [0, 0]
        }
      },
      size: () => {
        if (Array.isArray(size)) {
          return {buffer: sizeBuffer, divisor: 1}
        }
        return {constant: size}
      },
      borderSize: () => {
        if (Array.isArray(borderSize)) {
          return {buffer: borderSizeBuffer, divisor: 1}
        }
        return {constant: borderSize}
      },
      colorIdx: () => {
        if (Array.isArray(colorIdx)) {
          return {buffer: colorBuffer, divisor: 1}
        }
        return {constant: colorIdx}
      },
      borderColorIdx: () => {
        if (Array.isArray(borderColorIdx)) {
          return {buffer: borderColorBuffer, divisor: 1}
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

    scissor: {
      enable: true,
      box: ctx => {
        return viewport ? viewport : {
          x: 0, y: 0,
          width: ctx.drawingBufferWidth,
          height: ctx.drawingBufferHeight
        };
      }
    },

    viewport: ctx => {
      return !viewport ? {
        x: 0, y: 0,
        width: ctx.drawingBufferWidth,
        height: ctx.drawingBufferHeight
      } : viewport
    },

    depth: {
      enable: false
    },

    elements: regl.prop('elements'),
    count: regl.prop('count'),
    offset: regl.prop('offset'),

    primitive: 'points'
  }

  //draw sdf-marker
  let markerOptions = extend({}, shaderOptions)
  markerOptions.uniforms.marker = regl.prop('marker')
  markerOptions.frag = glslify('./marker.frag')
  markerOptions.vert = glslify('./marker.vert')

  drawMarker = regl(markerOptions)

  //draw circle
  let circleOptions = extend({}, shaderOptions)
  circleOptions.frag = glslify('./circle.frag')
  circleOptions.vert = glslify('./circle.vert')

  drawCircle = regl(circleOptions)


  //main draw method
  function draw (opts) {
    if (opts) {
      update(opts)
      if (opts.draw === false) return
    }

    if (!count) return

    //draw subset of of elements
    if (opts && (opts.elements || opts.ids)) {
      let els = opts.elements || opts.ids

      let pending = {};

      for (let i = 0; i < els.length; i++) {
       pending[els[i]] = true;
      }

      let batch = []
      for (let i = 0; i < markerIds.length; i++) {
        let subIds = [], ids = markerIds[i]

        for (let i = 0, l = ids.length; i < l; i++) {
          if (pending[ids[i]]) {
            subIds.push(ids[i])
            pending[ids[i]] = null
          }
        }

        batch.push({elements: subIds, offset: 0, count: subIds.length, marker: ids.texture})
      }

      drawCircle(batch.shift())
      drawMarker(batch)

      return
    }


    //draw circles
    drawCircle(getMarkerDrawOptions(markerIds[0]))

    if (!markerIds.length) return

    //draw all other available markers
    let batch = []
    for (let i = 1; i < markerIds.length; i++) {
      let ids = markerIds[i]

      //FIXME: report empty array elements bug to regl
      if (!ids.length) continue

      batch = batch.concat(getMarkerDrawOptions(ids))
    }
    drawMarker(batch)
  }

  //get options for the marker ids
  function getMarkerDrawOptions(ids) {
    //unsnapped options
    if (!ids.snap) {
      return {elements: ids.elements, offset: 0, count: ids.length, marker: ids.texture}
    }

    //scales batch
    let batch = []
    let {lod, x, w, texture} = ids

    let els = ids.elements

    for (let scaleNum = lod.length; scaleNum--;) {
      let level = lod[scaleNum]

      //FIXME: use minSize-adaptive coeff here, if makes sense, mb we need dist tho
      if (level.pixelSize && level.pixelSize < pixelSize && scaleNum > 1) continue

      let intervalStart = level.offset
      let intervalEnd = level.count + intervalStart

      let startOffset = search.ge(x, range[0], intervalStart, intervalEnd - 1)
      let endOffset = search.lt(x, range[2], startOffset, intervalEnd - 1) + 1

      if (endOffset <= startOffset) continue

      batch.push({elements: els, marker: texture, offset: startOffset, count: endOffset - startOffset})
    }

    return batch
  }

  function update (options) {
    if (options.length != null) options = {positions: options}

    //copy options to avoid mutation & handle aliases
    options = {
      positions: options.positions || options.data || options.points,
      snap: options.snap,
      size: options.sizes || options.size,
      borderSize: options.borderSizes || options.borderSize,
      color: options.colors || options.color,
      borderColor: options.borderColors || options.borderColor,
      palette: options.palette,
      marker: options.markers || options.marker,
      range: options.bounds || options.range,
      viewport: options.viewport,
      hiprecision: options.hiprecision
    }

    if (options.hiprecision != null) hiprecision = options.hiprecision

    if (options.snap != null) {
      if (options.snap === true) snap = 1e4
      else if (options.snap === false) snap = Infinity
      else snap = options.snap
    }

    //update buffer
    if (options.positions && options.positions.length) {
      //unroll positions
      let unrolled
      if (options.positions[0].length) {
        unrolled = Array(options.positions.length * 2)
        for (let i = 0, l = options.positions.length; i < l; i++) {
          unrolled[i*2] = options.positions[i][0]
          unrolled[i*2 + 1] = options.positions[i][1]
        }
      }
      else {
        unrolled = hiprecision ? new Float64Array(options.positions.length) : new Float32Array(options.positions.length)
        unrolled.set(options.positions)
      }

      positions = unrolled

      count = unrolled.length >> 1

      bounds = getBounds(unrolled, 2)

      if (!hiprecision) {
        positionBuffer(unrolled)
      }

      //hi-precision buffer has normalized coords and [hi,hi, lo,lo, hi,hi, lo,lo...] layout
      else {
        let precisePositions = new Float32Array(count * 4)

        //float numbers are more precise around 0
        let boundX = bounds[2] - bounds[0], boundY = bounds[3] - bounds[1]

        for (let i = 0, l = count; i < l; i++) {
          let nx = (unrolled[i * 2] - bounds[0]) / boundX
          let ny = (unrolled[i * 2 + 1] - bounds[1]) / boundY

          precisePositions[i * 4] = nx
          precisePositions[i * 4 + 1] = ny
          precisePositions[i * 4 + 2] = nx - precisePositions[i * 4]
          precisePositions[i * 4 + 3] = ny - precisePositions[i * 4 + 1]
        }

        positionBuffer(precisePositions)
      }
    }

    //sizes
    if (options.size != null) {
      size = options.size
      if (Array.isArray(size)) {
        sizeBuffer(size)

        maxSize = size[0]
        minSize = 1.5
        for (let i = 0, l = size.length; i < l; i++) {
          if (size[i] > maxSize) maxSize = size[i]
          if (size[i] > minSize) minSize = size[i]
        }
      }
      else {
        maxSize = size
        minSize = size
      }
    }

    //take over borders
    if (options.borderSize != null) {
      borderSize = options.borderSize

      if (Array.isArray(borderSize)) {
        borderSizeBuffer(borderSize)
      }
    }

    //process colors
    if (options.color || options.borderColor || options.palette) {
      //reset palette if passed
      if (options.palette) {
        let maxColors = 8192;

        palette = new Uint8Array(maxColors * 4)
        paletteIds = {}
        paletteCount = 0

        if (options.palette.length > maxColors) console.warn('regl-scatter2d: too many colors. Palette will be clipped.')

        for (let i = 0, l = Math.min(options.palette.length, maxColors); i < l; i++) {
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
        paletteTexture({
          width: palette.length/4,
          height: 1,
          data: palette
        })
      }
    }

    //aggregate markers sdf
    if (options.marker !== undefined || options.positions) {
      //reset marker elements
      markerIds.length = markerKey.length = 0
      markerIds.push([])
      markerKey.push(null)

      markers = options.marker

      //generic sdf marker
      if (!markers || typeof markers[0] === 'number') {
        elements = Array(count)
        for (let i = 0; i < count; i++) {
          elements[i] = i
        }
        updateMarker(markers, elements, maxSize)
      }
      //per-point markers
      else {
        for (let i = 0, l = markers.length; i < l; i++) {
          updateMarker(markers[i], i, Array.isArray(size) ? size[i] : size)
        }
      }
    }

    //update snaping if positions provided
    if (options.positions || options.snap != null) {
      let points = positions

      //recalculate per-marker type snapping
      //first, it is faster to snap 100 points 100 times than 10000 points once
      //second, it is easier to subset render per-marker than per-generic set
      for (let i = 0; i < markerIds.length; i++) {
        let ids = markerIds[i]

        let l = ids.length

        if (l * 2 > snap) {
          ids.snap = true
          let x = ids.x = Array(l)
          let w = ids.w = Array(l)
          let markerPoints = Array(l * 2)

          //shuffled_id: real_id
          let i2id = Array(l)

          for (let i = 0; i < l; i++) {
            let id = ids[i]
            markerPoints[i * 2] = points[id * 2]
            markerPoints[i * 2 + 1] = points[id * 2 + 1]
          }

          ids.lod = snapPoints(markerPoints, i2id, w, bounds)

          let idx = Array(l)
          for (let i = 0; i < l; i++) {
            let id = i2id[i]
            idx[i] = ids[id]
            x[i] = points[ids[id] * 2]
          }

          //put shuffled → direct element ids to memory
          ids.elements = regl.elements({
            primitive: 'points',
            type: 'uint32',
            data: idx
          })
        }

        //direct elements
        else {
          ids.elements = regl.elements({
            primitive: 'points',
            type: 'uint32',
            data: ids
          })
        }
      }
    }

    //make sure scale/translate are properly set
    if (!options.range && !range) options.range = bounds

    if (options.range) {
      range = options.range

      if (hiprecision) {
        let boundX = bounds[2] - bounds[0],
            boundY = bounds[3] - bounds[1]

        let nrange = [
          (range[0] - bounds[0]) / boundX,
          (range[1] - bounds[1]) / boundY,
          (range[2] - bounds[0]) / boundX,
          (range[3] - bounds[1]) / boundY
        ]

        scale = [1 / (nrange[2] - nrange[0]), 1 / (nrange[3] - nrange[1])]
        translate = [-nrange[0], -nrange[1]]

        scaleFract = fract32(scale)
        translateFract = fract32(translate)
      }

      else {
        scale = [1 / (range[2] - range[0]), 1 / (range[3] - range[1])]
        translate = [-range[0], -range[1]]

        scaleFract = [0, 0]
        translateFract = [0, 0]
      }

      //FIXME: possibly we have to use viewportWidth here from context
      pixelSize = (range[2] - range[0]) / regl._gl.drawingBufferWidth
    }

    //update visible attribs
    if ('viewport' in options) {
      let vp = options.viewport
      if (Array.isArray(vp)) {
        viewport = {
          x: vp[0],
          y: vp[1],
          width: vp[2] - vp[0],
          height: vp[3] - vp[1]
        }
      }
      else if (vp) {
        viewport = {
          x: vp.x || vp.left || 0,
          y: vp.y || vp.top || 0
        }

        if (vp.right) viewport.width = vp.right - viewport.x
        else viewport.width = vp.w || vp.width || 0

        if (vp.bottom) viewport.height = vp.bottom - viewport.y
        else viewport.height = vp.h || vp.height || 0
      }
      else {
        viewport = vp
      }
    }
  }

  //update borderColor or color
  function updateColor(colors) {
    if (!Array.isArray(colors)) {
      colors = [colors]
    }

    if (colors.length > 1 && colors.length < count) throw Error('Not enough colors')

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
  function updateMarker(sdfArr, id) {
    let ids

    let pos = sdfArr == null ? 0 : markerKey.indexOf(sdfArr)

    //existing marker
    if (pos >= 0) {
      ids = markerIds[pos]
      if (Array.isArray(id)) ids = markerIds[pos] = id
      else ids.push(id)
    }
    //new marker
    else {
      ids = Array.isArray(id) ? id : [id]
      markerKey.push(sdfArr)
      markerIds.push(ids)
    }

    //create marker texture
    if (sdfArr != null && !ids.texture) {
      let distArr
      if (sdfArr instanceof Uint8Array || sdfArr instanceof Uint8ClampedArray) {
        distArr = sdfArr
      }
      else {
        distArr = new Uint8Array(sdfArr.length)
        for (let i = 0, l = sdfArr.length; i < l; i++) {
          distArr[i] = sdfArr[i] * 255
        }
      }

      let radius = Math.floor(Math.sqrt(distArr.length))

      if (radius < maxSize) console.warn('SDF size is less than point size, ' + maxSize)

      ids.texture = regl.texture({
        channels: 1,
        data: distArr,
        radius: radius,
        mag: 'linear',
        min: 'linear'
      })
    }

    return ids
  }

  return draw
}

//return fractional part of float32 array
function fract32 (arr) {
  let f32arr = new Float32Array(arr.length)
  f32arr.set(arr)
  for (let i = 0, l = f32arr.length; i < l; i++) {
    f32arr[i] = arr[i] - f32arr[i]
  }
  return f32arr
}
