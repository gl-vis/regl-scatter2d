'use strict'

require('enable-mobile')
const createScatter = require('./')
const panZoom = require('pan-zoom')
const createSettings = require('settings-panel')
const fps = require('fps-indicator')({css:`padding: 1.4rem`})
const random = require('gauss-random')
const cluster = require('../point-cluster')
const rgba = require('color-rgba')
const nanoraf = require('nanoraf')
const palettes = require('nice-color-palettes')

//create square test sdf
let w = 200, h = 200
let dist = new Array(w*h)
for (let i = 0; i < w; i++) {
	for (let j = 0; j < h; j++) {
		if (i > j) {
			if (i < h - j) {
				dist[j*w + i] = j/(h/2)
			}
			else {
				dist[j*w + i] = 1 - (i-w/2)/(w/2)
			}
		}
		else {
			if (i < h - j) {
				dist[j*w + i] = i/(w/2)
			}
			else {
				dist[j*w + i] = 1 - (j-h/2)/(h/2)
			}
		}
	}
}

function show (arr) {
	let dim = Math.sqrt(arr.length)
	let cnv = document.body.appendChild(document.createElement('canvas'))
	let ctx = cnv.getContext('2d')
	let w = cnv.width = dim
	let h = cnv.height = dim
	let iData = new ImageData(w, h)
	let data = iData.data

	for (let i = 0; i < w; i++) {
		for (let j = 0; j < h; j++) {
			data[i*w*4 + j*4 + 0] = arr[i*w + j] * 255
			data[i*w*4 + j*4 + 1] = arr[i*w + j] * 255
			data[i*w*4 + j*4 + 2] = arr[i*w + j] * 255
			data[i*w*4 + j*4 + 3] = 255
		}
	}

	ctx.putImageData(iData, 0, 0)
}




let N = 1e4
let range = [-10, -10, 10, 10]
let colors = palettes[Math.floor(Math.random() * palettes.length)]
let markers = ['H', null]//, 'M0 0 L10 20 20 0Z']

let scatter = createScatter({
	positions: generate(N),
	// positions: [0,0, 1,1, -1,-1, 1,-1, -1,1, 0,1, 0,-1, 1,0, -1,0],

	size:  Array(N).fill(50).map(x => Math.random() * x),
	// size: 100,
	color: Array(N).fill(0).map(() => colors[Math.floor(Math.random() * colors.length)]),
	// color: 'rgba(0, 50, 100, .5)',

	marker: dist,

	range: range,
	borderSize: 2,
	borderColor: [[60, 80, 100, 200]]
})


scatter()



//interactions
let prev = null
var frame = nanoraf(scatter)
panZoom(document.body.lastChild, e => {
	let w = document.body.lastChild.offsetWidth
	let h = document.body.lastChild.offsetHeight

	let rx = e.x / w
	let ry = e.y / h

	let xrange = range[2] - range[0],
		yrange = range[3] - range[1]

	if (e.dz) {
		let dz = e.dz / w
		range[0] -= rx * xrange * dz
		range[2] += (1 - rx) * xrange * dz

		range[1] -= (1 - ry) * yrange * dz
		range[3] += ry * yrange * dz
	}

	range[0] -= xrange * e.dx / w
	range[2] -= xrange * e.dx / w
	range[1] += yrange * e.dy / h
	range[3] += yrange * e.dy / h

	let state = {range: range}
	frame(state, prev)
	prev = state
})


function generate(N) {
	var positions = new Float32Array(2 * N)

	for(var i=0; i<2*N; ++i) {
	  positions[i] = random()
	}

	return positions
}



window.addEventListener('resize', () => {
	scatter()
})

