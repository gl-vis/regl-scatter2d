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
    attribute vec3 color;
    attribute float size;

    uniform vec2 scale, translate;

    varying vec3 fragColor;

    void main() {
      gl_PointSize = size;
      gl_Position = vec4((position + translate) * scale * 2. - 1., 0, 1);
      gl_Position.y *= -1.;
      fragColor = color;
    }`,

    frag: `
    precision lowp float;
    varying vec3 fragColor;
    void main() {
      if (length(gl_PointCoord.xy - 0.5) > 0.5) {
        discard;
      }
      gl_FragColor = vec4(fragColor, 1);
    }`,

    uniforms: {
      scale: regl.this('scale'),
      translate: regl.this('translate')
    },

    attributes: {
      size: () => {
        return {constant: this.size}
      },
      color: () => {
        return {constant: this.color}
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
  if (!this.dirty) return
  this.dirty = false

  this.drawPoints()

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
