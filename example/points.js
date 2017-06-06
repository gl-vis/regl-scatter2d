/**
 * Test multiple points
 */
require('enable-mobile')
const setup = require('./setup')
const random = require('gauss-random')

//5e6 is allocation maximum
// var POINT_COUNT = 3e6
var POINT_COUNT = 1e5

var positions = new Float32Array(2 * POINT_COUNT)
for(var i=0; i<2*POINT_COUNT; ++i) {
  positions[i] = random()
}

// positions = [0,0, .25,.25, .5,.5, 1,1, 2, 2, 3, 3]

setup({
  positions:  positions,
  size:      5,
  color:     [0,0,0,1],
  borderSize: 1,
  borderColor: [.5,.5,.5,.5]
})

