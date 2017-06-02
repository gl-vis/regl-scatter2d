'use strict'

require('enable-mobile')
const createScatter = require('./')
const panZoom = require('pan-zoom')
const createSettings = require('settings-panel')
const fps = require('fps-indicator')({color: 'white'})

let scatter = createScatter({
  size: 1,
  color: 'green',
  // borderSize: 1,
  // borderColor: [.5,.5,.5,.5]
})

let settings = createSettings([
	{type: 'number', label: '№ points', min: 1, max: 1e8, log: true, value: 1e5, change: value => {
		var positions = new Float32Array(2 * value)

		for(var i=0; i<2*value; ++i) {
		  positions[i] = Math.random() * 2 - 1
		}

		scatter.update(positions).draw()
	}}
], {
	style: `
	bottom: 0;
	left: 0;
	right: 0;
	width: 300px;
	margin: auto;
	min-width: 200px;
	position: absolute;
	background: none;
	color: white;
	text-shadow: 0 0 5px black;
	`
})


//interactions
panZoom(canvas, e => {
	let w = canvas.width
	let h = canvas.height

	offset[0] += fromPx(e.dx, scale)
	offset[1] += fromPx(e.dy, scale)

	let prevScale = scale
	scale -= scale * e.dz / w

	let rx = e.x / w
	let ry = e.y / h

	offset[0] += fromPx(e.x, scale) - fromPx(e.x, prevScale)
	offset[1] += fromPx(e.y, scale) - fromPx(e.y, prevScale)

	// scatter.update({
	// 	scale: scale,
	// 	offset: offset
	// })
})


function toPx(v) {
	return v * scale
}
function fromPx(v, s) {
	return v / s
}
