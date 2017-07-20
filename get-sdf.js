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
function getSDF(arg, size) {
	//svg path or utf character
	if (typeof arg === 'string') {
	  arg = arg.trim()

	  canvas.width = size
	  canvas.height = size
	  ctx.fillStyle = 'black'
	  ctx.fillRect(0, 0, size, size)
	  ctx.fillStyle = 'white'

	  //svg path
	  if (arg[0] === 'm' || arg[0] === 'M') {

	    //if canvas svg paths api is available
	    if (global.Path2D) {
	      let path = new Path2D(arg)
	      ctx.fill(path)
	    }
	    //fallback to bezier-curves
	    else {
	      let segments = parsePath(arg)
	      drawPath(ctx, segments)
	      ctx.fill()
	    }
	  }

	  //plain character
	  else {
	    ctx.textAlign = 'center'
	    ctx.textBaseline = 'middle'
	    ctx.fillText(arg, size/2, size/2)
	  }

	  let data = sdf(ctx, {
	    cutoff: .25,
	    radius: size/3
	  })
	}

	//direct sdf data
	else if (Array.isArray(arg)) {
	  let data = arg
	}

	//image data, pixels, canvas, array
	else {
	  let data = sdf(arg, {
	    cutoff: .25,
	    radius: size/3,
	    width: size,
	    height: size
	  })
	}
}
