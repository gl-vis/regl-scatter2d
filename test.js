'use strict'

require('enable-mobile')
const createScatter = require('./')
const panZoom = require('pan-zoom')
const createSettings = require('settings-panel')
const fps = require('fps-indicator')({css:`padding: 1.4rem`})
const random = require('gauss-random')

let scatter = createScatter({
  size: 5,
  color: 'rgba(10, 120, 20, .75)',
  borderSize: 1,
  borderColor: [.1,.2,.3,1]
})

let settings = createSettings([
	{type: 'number', label: '№ points', min: 1, max: 1e8, log: true, value: 1e5, change: value => {
		let positions = generate(value)

		scatter.update(positions).autorange().draw()
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
	font-family: Roboto, sans-serif;
	font-weight: 300;
	`
})


function generate(N) {
	var positions = new Float32Array(2 * N)

	for(var i=0; i<2*N; ++i) {
	  positions[i] = random() * 100
	}

	return positions
}


//interactions
let canvas = scatter.canvas
panZoom(canvas, e => {
	let w = canvas.width
	let h = canvas.height
	let scale = scatter.scale
	let translate = scatter.translate

	translate[0] += fromPx(e.dx, scale[0])
	translate[1] += fromPx(e.dy, scale[1])

	let prevScale = scale.slice()

	scale[0] -= scale[0] * e.dz / w
	scale[1] -= scale[1] * e.dz / w

	let rx = e.x / w
	let ry = e.y / h

	translate[0] += fromPx(e.x, scale[0]) - fromPx(e.x, prevScale[0])
	translate[1] += fromPx(e.y, scale[1]) - fromPx(e.y, prevScale[1])
	scatter.update({
		scale: scale,
		// translate: translate
	})

	scatter.draw()

	function fromPx(v, s) {
		return v / s / w
	}
})

