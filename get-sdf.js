//return sdf of any argument

'use strict'

const sdf = require('bitmap-sdf')
const parsePath = require('parse-svg-path')
const drawPath = require('draw-svg-path')
const normalizePath = require('normalize-svg-coords')

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')

module.exports = getSDF

//return bitmap sdf data from any argument
function getSDF(arg, markerSize) {
	let size = markerSize * 2
	let w = canvas.width = size * 2
	let h = canvas.height = size * 2
	let cutoff = .2
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
	  if (arg[0] === 'm' || arg[0] === 'M') {
	  	//FIXME: make this good
		ctx.translate(size, size)
		ctx.scale(1, 1)

	    //if canvas svg paths api is available
	    if (global.Path2D) {
	      let path = new Path2D(arg)
	      ctx.fill(path)
	      ctx.stroke(path)
	    }
	    //fallback to bezier-curves
	    else {
	      let segments = parsePath(arg)
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


function show(arr) {
	let cnv = document.body.appendChild(document.createElement('canvas'))
	let ctx = cnv.getContext('2d')
	cnv.width = canvas.width
	cnv.height = canvas.height

	let size = Math.sqrt(arr.length)
	let w = size, h = size

	//show distances
	let imgArr = new Uint8ClampedArray(w * h * 4)
	for (let i = 0; i < w; i++) {
		for (let j = 0; j < h; j++) {
			imgArr[j*w*4 + i*4 + 0] = arr[j*w+i]*255
			imgArr[j*w*4 + i*4 + 1] = arr[j*w+i]*255
			imgArr[j*w*4 + i*4 + 2] = arr[j*w+i]*255
			imgArr[j*w*4 + i*4 + 3] = 255
		}
	}
	var data = new ImageData(imgArr, w, h)
	ctx.putImageData(data, 0, 0)
}
