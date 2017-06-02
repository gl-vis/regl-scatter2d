'use strict'

const createRegl = require('regl')
// const pointCluster = require('../point-cluster')
const extend = require('object-assign')
const rgba = require('color-rgba')

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

  this.init(options)
  this.update(options)
}

Scatter.prototype.positions = []
Scatter.prototype.selection = null
Scatter.prototype.scale = 1
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

  //TODO: figure out required code here: different color, different size, different shape
  this.drawPoints = regl({
    vert: `
    precision mediump float;

    attribute vec2 position;
    attribute vec3 color;
    attribute float size;

    // uniform vec2 scale, translate;

    varying vec3 fragColor;

    void main() {
      gl_PointSize = size;
      gl_Position = vec4(position, 0, 1);
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
      // scale: regl.this('scale'),
      // translate: regl.this('translate')
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

  //buffer contains color, position,
  if (positions) {
    this.buffer(positions)
    this.pointCount = Math.floor(positions.length / 2)
  }

  //eval colors
  if (typeof this.color === 'string') {
    this.color = rgba(this.color)
  }
  if (typeof this.borderColor === 'string') {
    this.borderColor = rgba(this.borderColor)
  }

  return this
}

// Then we assign regl commands directly to the prototype of the class
Scatter.prototype.draw = function () {
  this.drawPoints()

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
