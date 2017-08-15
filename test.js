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
const sdf = require('bitmap-sdf')
const parsePath = require('parse-svg-path')
const drawPath = require('draw-svg-path')
const normalizePath = require('normalize-svg-coords')
const pathBounds = require('svg-path-bounds')
const isSvgPath = require('is-svg-path')



//create square test sdf image
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



let N = 1e6
let ratio = window.innerWidth / window.innerHeight
let range = [-10 * ratio, -10, 10 * ratio, 10]
let colors = palettes[Math.floor(Math.random() * palettes.length)]
let markers = [null]//, 'M0 0 L10 20 20 0Z']

let scatter = createScatter({
	positions: generate(N),
	// positions: [0,0, .1,.1, .2,.2, .3,.3, .4,.4, .5,.5, .6,.6, .7,.7, .8,.8, .9,.9, 1,1],
	// positions: [0,0, 1,1, -1,-1, 1,-1, -1,1, 0,1, 0,-1, 1,0, -1,0],

	// size:  Array(N).fill(100).map(x => Math.random() * x),
	size: 10,
	// color: Array(N).fill(0).map(() => colors[Math.floor(Math.random() * colors.length)]),
	color: 'rgba(0, 0, 0, .5)',

	marker: Array(N).fill(0).map(() => markers[Math.floor(Math.random() * markers.length)]),

	range: range,
	borderSize: 1,
	snap: 1e1,
	borderColor: [[127,127,127,127]]
})


scatter()

// setTimeout(() => {
// 	scatter({snap: 1})
// })



//interactions
let prev = null
var frame = nanoraf(scatter)

let cnv = document.body.querySelectorAll('canvas')[1]

panZoom(cnv, e => {
	//FIXME: panzoom fails working right on ipad
	let w = cnv.offsetWidth
	let h = cnv.offsetHeight

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






function getCharSdf(char, size) {
	if (!size) size = 200

	let cnv = document.createElement('canvas')
	let ctx = cnv.getContext('2d')

	let w = cnv.width = size
	let h = cnv.height = size

	ctx.fillStyle = 'black'
	ctx.fillRect(0, 0, w, h)
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.font = size/2 + 'px sans-serif'

	ctx.fillStyle = 'white'
	ctx.fillText(char, size/2, size/2)

	let data = sdf(ctx, {
		cutoff: .1,
		radius: size/2
	})

	// show(data)

	return data
}

//return bitmap sdf data from any argument
function getSDF(arg, markerSize) {
	let size = markerSize * 2
	let w = canvas.width = size * 2
	let h = canvas.height = size * 2
	let cutoff = 1
	let radius = size/2
	let data

	//FIXME: replace with render-svg or rasterize-svg module or so
	//svg path or utf character
	if (typeof arg === 'string') {
	  arg = arg.trim()

	  ctx.fillStyle = 'black'
	  ctx.fillRect(0, 0, w, h)
	  ctx.fillStyle = 'white'
	  ctx.strokeStyle = 'white'
	  ctx.lineWidth = 1

	  //svg path
	  if (isSvgPath(arg)) {
	  	let path = normalizePath({
	  		path: arg,
	  		viewBox: pathBounds(arg),
	  		min: 0,
	  		max: size
	  	})

	  	//FIXME: make this good
		ctx.translate(size, size)

	    //if canvas svg paths api is available
	    if (global.Path2D) {
	      let path2d = new Path2D(path)
	      ctx.fill(path2d)
	      ctx.stroke(path2d)
	    }
	    //fallback to bezier-curves
	    else {
	      let segments = parsePath(path)
	      drawPath(ctx, segments)
	      ctx.fill()
	      ctx.stroke()
	    }

		ctx.setTransform(1, 0, 0, 1, 0, 0);
	  }

	  //plain character
	  else {
	    ctx.textAlign = 'center'
	    ctx.textBaseline = 'middle'
	    ctx.font = size + 'px sans-serif'
	    ctx.fillText(arg, size, size)
	  }

	  data = sdf(ctx, {
	    cutoff: cutoff,
	    radius: radius
	  })
	}

	//direct sdf data
	else if (Array.isArray(arg)) {
	  data = arg
	}

	//image data, pixels, canvas, array
	else {
	  data = sdf(arg, {
	    cutoff: cutoff,
	    radius: radius,
	    width: w,
	    height: h
	  })
	}

	// show(data, arg)

	return data
}

