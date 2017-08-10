'use strict'

const createRegl = require('regl')
const rgba = require('color-rgba')
const getBounds = require('array-bounds')
const clamp = require('clamp')
const colorId = require('color-id')
const snapPoints = require('../snap-points-2d')
const normalize = require('array-normalize')
const extend = require('object-assign')
const glslify = require('glslify')
const assert = require('assert')
const search = require('binary-search-bounds')
const sliced = require('sliced')

module.exports = Scatter


function Scatter (options) {
  if (!options) options = {}

  // persistent variables
  let regl, gl, canvas, plot,
      range, elements = [],
      size = 12, maxSize = 12, minSize = 12,
      borderSize = 1,
      positions, count, selection, bounds,
      scale, translate,
      drawMarker, drawCircle,
      sizeBuffer, positionBuffer,
      paletteTexture, palette = [], paletteIds = {}, paletteCount = 0,
      colorIdx = 0, colorBuffer,
      borderColorBuffer, borderColorIdx = 1, borderSizeBuffer,
      markerIds = [[]], markerKey = [null], markers,
      snap = 1e4, pixelSize

  // regl instance
  if (options.regl) regl = options.regl

  // container/gl/canvas case
  else {
    let opts = {}
    opts.pixelRatio = options.pixelRatio || global.devicePixelRatio
    if (options.canvas) opts.canvas = options.canvas
    if (options.container) opts.container = options.container
    if (options.gl) opts.gl = options.gl

    opts.optionalExtensions = [
      'OES_element_index_uint'
    ]

    regl = createRegl(opts)
  }

  // compatibility
  gl = regl._gl
  canvas = gl.canvas

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

  update(options)


  //common shader options
  let shaderOptions = {
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

    count: regl.prop('count'),
    offset: regl.prop('offset'),

    primitive: 'points'
  }

  //intercepting context
  let initShader = regl({})

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
    if (opts) update(opts)

    if (!count) return

    // console.time('draw')
    initShader((params) => {
      let vh = params.viewportHeight, vw = params.viewportWidth

      //draw all available markers
      for (let i = 0; i < markerIds.length; i++) {
        let ids = markerIds[i]
        //FIXME: report empty array elements bug to regl
        if (!ids.length) continue

        //render unsnapped points
        if (!ids.snap) {
          ids.texture ?
            drawMarker({elements: ids.elements, offset: 0, count: ids.length, marker: ids.texture}) :
            drawCircle({elements: ids.elements, offset: 0, count: ids.length})
        }

        //render snapped subsets
        else {
          let {scale, x, w, texture} = ids

          let pixelSize = (range[2] - range[0]) / vw

          let els = ids.elements

          for (let scaleNum = scale.length; scaleNum--;) {
            let lod = scale[scaleNum]

            if (lod.pixelSize < pixelSize) continue


            //FIXME: put elements per-scale

            //FIXME: use minSize-adaptive coeff here, if makes sense, mb we need dist tho
            // if(lod.pixelSize && (lod.pixelSize < pixelSize * 1.25) && scaleNum > 1) {
            //   continue
            // }

            let intervalStart = lod.offset
            let intervalEnd = lod.count + intervalStart


            let startOffset = search.ge(x, range[0], intervalStart, intervalEnd - 1)
            let endOffset = search.lt(x, range[2], startOffset, intervalEnd - 1) + 1

            // if (endOffset <= startOffset) continue

            // texture ?
            // drawMarker({elements: els, marker: texture, offset: startOffset, count: endOffset - startOffset}) :
            // drawCircle({elements: els, offset: startOffset, count: endOffset - startOffset})

            texture ?
            drawMarker({elements: els, marker: texture, offset: intervalStart, count: lod.count}) :
            drawCircle({elements: els, offset: lod.offset, count: lod.count})

            // let els = ids.subarray(startOffset, endOffset)
            // let els = ids.elements({offset: startOffset, count: endOffset - startOffset})
          }
        }
      }

      // console.timeEnd('draw')
    })
  }

  function update (options) {
    console.time('update')
    if (options.length != null) options = {positions: options}

    if (options.snap != null) {
      if (options.snap === true) snap = 1e4
      else if (options.snap === false) snap = Infinity
      else snap = options.snap
    }

    //update buffer
    // console.time(1)
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
        unrolled = new Float32Array(options.positions.length)
        unrolled.set(options.positions)
        // unrolled = sliced(options.positions)
      }
      // console.timeEnd(1)

      count = Math.floor(unrolled.length / 2)

      bounds = getBounds(unrolled, 2)
      positions = normalize(unrolled, 2, bounds)
      positionBuffer(positions)
    }

    //sizes
    // console.time(3)
    if (options.sizes) options.size = options.sizes
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
    if (options.borderSizes) options.borderSize = options.borderSizes
    if (options.borderSize != null) {
      borderSize = options.borderSize

      if (Array.isArray(borderSize)) {
        borderSizeBuffer(borderSize)
      }
    }
    // console.timeEnd(3)

    //process colors
    // console.time(4)
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
          palette = sliced(palette, 0, 8192*4)
        }

        paletteTexture({
          width: palette.length/4,
          height: 1,
          data: palette
        })
      }
    }
    // console.timeEnd(4)

    //aggregate markers sdf
    // console.time(5)
    if (options.markers) options.marker = options.markers
    if (options.marker !== undefined || markers === undefined) {
      if (options.marker !== undefined) {
        //reset marker elements
        markerIds.length = markerKey.length = 1

        //common marker
        if (typeof options.marker[0] === 'number') {
          elements = Array(count)
          for (let i = 0; i < count; i++) {
            elements[i] = i
          }
          updateMarker(options.marker, elements, maxSize)
        }
        //per-point markers
        else {
          for (let i = 0, l = options.marker.length; i < l; i++) {
            updateMarker(options.marker[i], i, Array.isArray(size) ? size[i] : size)
          }
        }

        markers = options.marker
      }
      else if (markers === undefined) {
        markers = null
        elements = Array(count)
        for (let i = 0; i < count; i++) {
          elements[i] = i
        }
        updateMarker(markers, elements, maxSize)
      }
    }
    // console.timeEnd(5)

    //update snaping if positions provided
    // console.time(6)
    if (options.positions) {
      let points = options.positions

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

          let scale = ids.scale = snapPoints(markerPoints, i2id, w, bounds)

          let idx = Array(l)
          for (let i = 0; i < l; i++) {
            x[i] = markerPoints[i * 2]
            idx[i] = ids[i2id[i]]
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
    // console.timeEnd(6)

    //make sure scale/translate are properly set
    // console.time(7)
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
    // console.timeEnd(7)
    console.timeEnd('update')
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
