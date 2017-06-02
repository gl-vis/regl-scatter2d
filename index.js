'use strict'

const createRegl = require('regl')
// const pointCluster = require('../point-cluster')
const extend = require('object-assign')
const rgba = require('color-rgba')
const getBounds = require('array-bounds')

module.exports = Scatter

function Scatter (options) {
  if (!(this instanceof Scatter)) return new Scatter(options)

  if (options.regl) this.regl = options.regl
  else {
    this.regl = createRegl({
      pixelRatio: options.pixelRatio || this.pixelRatio,
      gl: options.gl,
      container: options.container,
      canvas: options.canvas
    })
  }

  // refs for compat
  this.gl = this.regl._gl
  this.canvas = this.gl.canvas
  this.container = this.canvas.parentNode

  this.init(options)
}

Scatter.prototype.positions = []
Scatter.prototype.selection = null
Scatter.prototype.scale = [1, 1]
Scatter.prototype.translate = [0, 0]
Scatter.prototype.size = 10
Scatter.prototype.color = 'rgba(10, 100, 200, .75)'
Scatter.prototype.borderSize = 1
Scatter.prototype.borderColor = 'white'
Scatter.prototype.pixelRatio = window.devicePixelRatio
Scatter.prototype.gl = null
Scatter.prototype.viewBox = null
Scatter.prototype.dataBox = null
Scatter.prototype.pointCount = 0


//create drawing methods based on initial options
Scatter.prototype.init = function (options) {
  let regl = this.regl

  this.buffer = regl.buffer({
    usage: 'dynamic',
    type: 'float',
    data: null
  })

  this.update(options)
  this.autorange()

  //TODO: figure out required code here: different color, different size, different shape
  this.drawPoints = regl({
    vert: `
    precision mediump float;

    attribute vec2 position;
    attribute float size;

    uniform vec2 scale, translate;

    void main() {
      gl_PointSize = size;
      gl_Position = vec4((position + translate) * scale * 2. - 1., 0, 1);
      gl_Position.y *= -1.;
    }`,

    frag: `
    precision mediump float;
    uniform vec4 color, borderColor;
    uniform float centerFraction;

    const float fragWeight = 1.0;

    float smoothStep(float x, float y) {
      return 1.0 / (1.0 + exp(50.0*(x - y)));
    }

    void main() {
      float radius = length(2.0*gl_PointCoord.xy-1.0);
      if(radius > 1.0) {
        discard;
      }
      vec4 baseColor = mix(borderColor, color, smoothStep(radius, centerFraction));
      float alpha = 1.0 - pow(1.0 - baseColor.a, fragWeight);
      gl_FragColor = vec4(baseColor.rgb * alpha, alpha);
    }`,

    uniforms: {
      scale: regl.this('scale'),
      translate: regl.this('translate'),
      centerFraction: ctx => this.borderSize === 0 ? 2 : this.size / (this.size + this.borderSize + 1.25),
      color: regl.prop('color'),
      borderColor: regl.prop('borderColor')
    },

    attributes: {
      size: () => {
        return {constant: this.size}
      },
      // here we are using 'points' proeprty of the mesh
      position: this.buffer
    },

    count: regl.this('pointCount'),

    // and same for the selection
    // elements: regl.this('selection'),

    primitive: 'points'
  })

  return this
}

Scatter.prototype.update = function (options) {
  let regl = this.regl

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
    pixelRatio,
    gl,
    viewBox,
    dataBox
  } = options

  extend(this, options)

  //update buffer
  if (positions) {
    this.buffer(positions)
    this.pointCount = Math.floor(positions.length / 2)
  }

  //colors
  if (typeof this.color === 'string') {
    this.color = rgba(this.color)
  }
  if (typeof this.borderColor === 'string') {
    this.borderColor = rgba(this.borderColor)
  }

  //make sure scale/translate are properly set
  if (typeof this.translate === 'number') this.translate = [this.translate, this.translate]
  if (typeof this.scale === 'number') this.scale = [this.scale, this.scale]

  this.dirty = true

  return this
}

// Then we assign regl commands directly to the prototype of the class
Scatter.prototype.draw = function () {
  //TODO: make multipass-render here, by color/glyph pairs
  //TODO: some events may trigger twice in a single frame, which results in darker frame
  if (!this.dirty) return
  this.dirty = false

  this.regl.poll()

  this.drawPoints({
    color: this.color,
    borderColor: this.borderColor
  })

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

Scatter.prototype.pick = function () {
  //TODO: init regl draw here
  return this
}

Scatter.prototype.dispose = function () {

  return this
}

Scatter.prototype.select = function () {
  //TODO: init regl draw here
  return this
}
