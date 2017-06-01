'use strict'

const createRegl = require('regl')
// const pointCluster = require('../point-cluster')
const extend = require('object-assign')

module.exports = Scatter

function Scatter (options) {
  if (!(this instanceof Scatter)) return new Scatter(options)

  this.regl = createRegl({
    pixelRatio: options.pixelRatio || this.pixelRatio,
    gl: options.gl,
    container: options.container,
    canvas: options.canvas
  })

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

  this.positionBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'float',
    data: null
  })

  //TODO: figure out required code here: different color, different size, different shape
  this.drawPoints = regl({
    vert: `
    precision mediump float;

    attribute vec2 position;
    // attribute vec3 color;
    // attribute float size;

    // uniform vec2 scale, translate;

    // varying vec3 fragColor;

    void main() {
      gl_PointSize = 10.;//size;
      gl_Position = vec4(position, 0, 1);
      // fragColor = color;
    }`,

    frag: `
    precision lowp float;
    // varying vec3 fragColor;
    void main() {
      // if (length(gl_PointCoord.xy - 0.5) > 0.5) {
      //   discard;
      // }
      gl_FragColor = vec4(0,0,0, 1);
    }`,

    uniforms: {
      // scale: regl.this('scale'),
      // translate: regl.this('translate')
    },

    attributes: {
      // size: regl.this('size'),
      // color: {
      //   buffer: pointBuffer,
      //   stride: VERT_SIZE,
      //   offset: 32
      // },
      // here we are using 'points' proeprty of the mesh
      position: this.positionBuffer
    },

    count: regl.this('pointCount'),

    // and same for the selection
    // elements: regl.this('selection'),

    primitive: 'points'
  })
}

Scatter.prototype.update = function (options) {
  let regl = this.regl

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

  //buffer contains color, position,
  if (positions) {
    this.positionBuffer(positions)
    this.pointCount = positions.length / 2
  }

  //put all positions into buffer

  return this
}

// Then we assign regl commands directly to the prototype of the class
Scatter.prototype.draw = function () {
  this.drawPoints()
}


Scatter.prototype.pick = function () {
  //TODO: init regl draw here
}

Scatter.prototype.dispose = function () {

}

Scatter.prototype.select = function () {
  //TODO: init regl draw here
}
