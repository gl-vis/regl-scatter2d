'use strict'

require('enable-mobile')
const Scatter = require('./')


//create data
var POINT_COUNT = 1e4

var positions = new Float32Array(2 * POINT_COUNT)
for(var i=0; i<2*POINT_COUNT; ++i) {
  positions[i] = Math.random() * 2 - 1
}

let scatter = Scatter({
  positions: positions,
  // size: 5,
  // color: [0,0,0,1],
  // borderSize: 1,
  // borderColor: [.5,.5,.5,.5]
})

scatter.draw()
