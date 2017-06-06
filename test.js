'use strict'

require('enable-mobile')
const createScatter = require('./')
const panZoom = require('pan-zoom')
const createSettings = require('settings-panel')
const fps = require('fps-indicator')({css:`padding: 1.4rem`})
const random = require('gauss-random')
const cluster = require('../point-cluster')
const rgba = require('color-rgba')


let N = 1e5
let scatter = createScatter({
	positions: generate(N),
	// positions: [0,0, 1,1, -1,-1, 1,-1, -1,1, 0,1, 0,-1, 1,0, -1,0],

	size:  Array(N).fill(20).map(x => Math.random() * x),
	// size: 10,
	color: Array(N).fill(0).map(() =>
				[Math.random(), Math.random(), Math.random(), Math.random()]
			),
	// color: 'rgba(0, 10, 10, .3)',

	borderSize: 1,
	cluster: false,
	borderColor: [.1,.2,.3,1]
})
.autorange()
.draw()

/*
let settings = createSettings([
	{type: 'number', label: '№ points', min: 1, max: 1e8, log: true, value: 1e4, change: value => {
		let positions = generate(value)
		// let positions = [0,0, 1,1, -1,-1, 1,-1, -1,1, 0,1, 0,-1, 1,0, -1,0]

		// let from = lod[6].offset, to = from + lod[6].count
		scatter
		.update(positions)
		.autorange()
		.clear()
		.draw()
	}},
	{type: 'interval', label: 'Size', min: 1, max: 50, value: [10,10], step: .5, change: value => {
		//same size
		if (value[0] === value[1]) {
			scatter.update({
				size: value[0]
			})
			.clear()
			.draw()
			return
		}

		let sizes = []
		for (let i = 0, l = scatter.positions.length/2; i < l; i++) {
			sizes.push(Math.random() * (value[1] - value[0]) + value[0])
		}
		scatter.update({
			size: sizes
		})
		.clear()
		.draw()
	}},
	{type: 'checkbox', label: 'Multicolor', value: false, change: v => {
		if (v) {
			//generate colors
			let colors = Array(scatter.positions.length/2).fill(0).map(() =>
				[Math.random(), Math.random(), Math.random(), Math.random()]
			)
			scatter.update({color: colors})
		}
		else {
			let color = Array(4).fill(0).map(Math.random)
			scatter.update({color: color})
		}
		scatter.draw()
	}}
], {
	theme: require('settings-panel/theme/control'),
	style: `
	bottom: 0;
	left: 0;
	right: 0;
	width: 340px;
	margin: auto;
	min-width: 240px;
	position: absolute;
	background: none;
	font-family: Roboto, sans-serif;
	font-weight: 300;
	`
})
*/


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
		scale: e.dz ? scale : null,
		translate: translate
	})

	scatter.clear()
	scatter.draw()

	function fromPx(v, s) {
		return v / s / w
	}
})


function generate(N) {
	var positions = new Float32Array(2 * N)

	for(var i=0; i<2*N; ++i) {
	  positions[i] = random()
	}

	return positions
}
