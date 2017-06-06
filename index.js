'use strict'

const createRegl = require('regl')
const extend = require('object-assign')
const rgba = require('color-rgba')
const getBounds = require('array-bounds')
const clamp = require('clamp')
const atlas = require('font-atlas-sdf')
const colorId = require('color-id')
const snapPoints = require('snap-points-2d')

module.exports = Scatter

function Scatter (options) {
  if (!(this instanceof Scatter)) return new Scatter(options)

  // regl instance
  if (options.regl) this.regl = options.regl

  // gl-plot2d case
  else if (options.plot) {
    this.plot = options.plot

    this.regl = createRegl({
      gl: this.plot.gl,
      pixelRatio: this.plot.pixelRatio
    })

    this.plot.addObject(this)
  }

  // container/gl/canvas case
  else {
    this.regl = createRegl({
      pixelRatio: options.pixelRatio || this.pixelRatio,
      gl: options.gl,
      container: options.container,
      canvas: options.canvas
    })
  }

  // refs for compatibility
  this.gl = this.regl._gl
  this.canvas = this.gl.canvas
  this.container = this.canvas.parentNode

  this.init(options)
}

//last positions raw data
Scatter.prototype.positions = []
Scatter.prototype.pointCount = 0

//selected point indexes array
Scatter.prototype.selection = null

//current viewport settings
Scatter.prototype.scale = [1, 1]
Scatter.prototype.translate = [0, 0]
//TODO
Scatter.prototype.viewBox = null
Scatter.prototype.dataBox = null

//point style options
Scatter.prototype.size = 12
Scatter.prototype.color = [1,0,0,1]
Scatter.prototype.borderSize = 1
Scatter.prototype.borderColor = [0,0,0,1]

//gl settings
Scatter.prototype.pixelRatio = window.devicePixelRatio
Scatter.prototype.gl = null
Scatter.prototype.container = null
Scatter.prototype.canvas = null

//group points for faster rendering of huge number of them
Scatter.prototype.cluster = false

//font atlas texture singleton
Scatter.prototype.charCanvas     = document.createElement('canvas')
Scatter.prototype.charStep       = 400


//create drawing methods based on initial options
Scatter.prototype.init = function (options) {
  let regl = this.regl

  //textures for glyphs and color palette
  this.charTexture = regl.texture(this.charCanvas)

  //awesome buffers to reuse
  this.sizeBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'float',
    data: null
  })
  this.positionBuffer = regl.buffer({
    usage: 'static',
    type: 'float',
    data: null
  })
  this.colorBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'uint8',
    data: null
  })

  this.update(options)

  this.drawPoints = regl({
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
      gl_Position = vec4((position + translate) * scale * 2. - 1., 0, 1);
      gl_Position.y *= -1.;

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
      scale: regl.this('scale'),
      translate: regl.this('translate'),
      borderColor: regl.this('borderColor'),
      borderSize: regl.this('borderSize')
    },

    attributes: {
      position: this.positionBuffer,
      size: () => {
        if (Array.isArray(this.size)) {
          return this.sizeBuffer
        }
        return {constant: this.size}
      },
      color: () => {
        if (Array.isArray(this.color[0])) {
          return this.colorBuffer
        }
        return {constant: this.color}
      }
    },

    count: regl.this('pointCount'),

    // and same for the selection
    // elements: [0,1],

    primitive: 'points'
  })

  this.drawTest = regl({
    frag: `
    precision mediump float;

    void main() {
      gl_FragColor = vec4(0, 1, 0, 1);
    }`,

    vert: `
    precision mediump float;
    attribute vec2 position;

    void main() {
      gl_Position = vec4(position, 0, 1);
    }`,

    attributes: {
      position: [[-1, -1], [1, 0], [0, 1]]
    },

    count: 3
  })

  return this
}

Scatter.prototype.update = function (options) {
  let regl = this.regl, w = this.canvas.width, h = this.canvas.height

  if (options.length != null) options = {positions: options}

  let {
    positions,
    selection,
    scale,
    translate,
    size,
    color,
    borderSize,
    borderColor,
    glyph,
    pixelRatio,
    viewBox,
    dataBox,
    cluster
  } = options

  if (cluster != null) this.cluster = cluster

  //make sure scale/translate are properly set
  if (translate != null) {
    this.translate = typeof translate === 'number' ? [translate, translate] : translate
  }
  if (scale != null) {
    this.scale = typeof scale === 'number' ? [scale, scale] : scale
    this.scale[0] = Math.max(this.scale[0], 1e-10)
    this.scale[1] = Math.max(this.scale[1], 1e-10)
  }

  //update buffer
  if (positions != null) {
    if (this.cluster) {
      //do clustering
      //TODO: send clustering to worker
      this.getPoints = clusterPoints(positions)
    }
    else {
      this.positionBuffer(positions)
      this.pointCount = Math.floor(positions.length / 2)
    }
    this.positions = positions
  }

  //sizes
  if (size != null) {
    this.size = size
    if (Array.isArray(this.size)) {
      this.sizeBuffer(this.size)
    }
  }

  if (borderSize != null) this.borderSize = borderSize

  //reobtain points in case if translate/scale/positions changed
  if (scale != null || positions != null) {
    //recalc bounds for the data
    let bounds = [
      -this.translate[0], -this.translate[1],
      .5/this.scale[0] ,
      .5/this.scale[1]
    ]

    if (this.cluster) {
      //TODO: read actual point radius/size here
      let radius = Array.isArray(this.size) ? (id => this.size) : ( (this.size / Math.max(w, h) ) / this.scale[0])
      let ids = this.getPoints(radius)

      let subpositions = new Float32Array(ids.length * 2)
      for (let i = 0, id; i < ids.length; i++) {
        let id = ids[i]
        subpositions[i*2] = this.positions[id*2]
        subpositions[i*2+1] = this.positions[id*2+1]
      }
      this.positionBuffer(subpositions)
      this.pointCount = Math.floor(subpositions.length / 2)
    }
  }

  //process colors
  if (color != null) {
    //ensure colors are arrays
    if (Array.isArray(color) && (Array.isArray(color[0]) || typeof color[0] === 'string')) {
      for (let i = 0, l = this.positions.length/2; i < l; i++) {
        if (color[i] != null) {
          color[i] = rgba(color[i])
        }
        else {
          color[i] = Scatter.prototype.color
        }
      }
      this.colorBuffer(color)
    }
    else if (typeof color === 'string') {
      color = rgba(color)
    }
    this.color = color
  }
  if (borderColor != null) {
    this.borderColor = borderColor
  }

  //aggregate glyphs
  if (glyph != null) {
    var glyphChars = {}
    for (var i = 0, l = pointCount, k = 0; i < l; i++) {
      var char = glyphs[i]
      if (glyphChars[char] == null) {
        glyphChars[char] = k++
      }
    }
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

  return this
}

// Then we assign regl commands directly to the prototype of the class
Scatter.prototype.draw = function (options) {
  //TODO: make multipass-render here
  //TODO: some events may trigger twice in a single frame, which results in darker frame
  this.regl._refresh()
  this.regl.poll()

  this.drawPoints()
  // this.drawTest()

  return this
}

// adjust scale and transform so to see all the data
Scatter.prototype.autorange = function (positions) {
  if (!positions) positions = this.positions
  if (!positions || positions.length == 0) return this;

  let bounds = getBounds(positions, 2)

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

Scatter.prototype.pick = function () {

}


Scatter.prototype.drawPick = function () {
  //TODO: init regl draw here
  return this
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



//TODO: move to a separate quadtree-based package
function createCluster (points) {
  let scales = snapPoints(points, [], [], [])

  return function getPoints (pixelSize, bounds) {
     for(var scaleNum = scales.length - 1; scaleNum >= 0; scaleNum--) {
      var lod = scales[scaleNum]
      if(lod.pixelSize < pixelSize && scaleNum > 1)
        continue

      var range = this.getVisibleRange(lod)
      var startOffset = range[0], endOffset = range[1]

      if(endOffset > startOffset)
        gl.drawArrays(gl.POINTS, startOffset, endOffset - startOffset)

      if(!pick && firstLevel) {
        firstLevel = false
        shader.uniforms.useWeight = 0
      }
    }
  }
}
