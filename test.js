'use strict'

require('enable-mobile')
const createScatter = require('./')
const panZoom = require('pan-zoom')
const createSettings = require('settings-panel')
const fps = require('fps-indicator')({css:`padding: 1.4rem`})
const random = require('gauss-random')
const cluster = require('../point-cluster')

// let points = generate(1e7)
// const kdtree = require('../kdgrass')
// const snap = require('snap-points-2d')
// console.time(1)
// snap(points, new Array(points.length/2),new Array(points.length/2),new Array(points.length/2))
// console.timeEnd(1)
// console.time(2)
// kdtree(points, 1)
// console.timeEnd(2)


// const kdtree = require('../kdgrass')
// let canvas = document.body.appendChild(document.createElement('canvas'))
// let points = generate(1e3)
// let tree = kdtree(points, 1)

// let ctx = canvas.getContext('2d')
// let w = canvas.width = 600
// let h = canvas.height = 600
// ctx.fillStyle = 'gray'
// for (let i = 0; i < points.length/2; i++) {
// 	let x = points[i*2], y = points[i*2+1]
// 	ctx.fillRect(x*w - 2.5, y*h - 2.5, 5, 5)
// }

// drawSections(20)

//NOTE: expect we're dealing with normalized data
function drawSections(maxDepth) {
	draw(0, tree.ids.length - 1, 0, 0, [0, 0, 1, 1])

	function draw(from, to, axis, depth, box) {
	    ctx.fillStyle = axis ? 'blue' : 'red'

	    if (to - from <= tree.nodeSize) {
	    	// ctx.fillText(from + '-' + to, (box[0]+box[2])*.5*w, (box[1]+box[3])*.5*h)
	        return;
	    }

	    var m = Math.floor((from + to) / 2);

	    var x = tree.coords[2 * m];
	    var y = tree.coords[2 * m + 1];


	    var lineWidth = 1//Math.max(1, depth)
	    if (axis) {
		    ctx.fillRect(box[0]*w,y*h,(box[2]-box[0])*w,lineWidth)
	    }
	    else {
		    ctx.fillRect(x*w,box[1]*h,lineWidth,(box[3]-box[1])*h)
	    }

	    var nextAxis = (axis + 1) % 2;

	    depth++

	    if (depth <= maxDepth) {
	    	let box1 = box.slice()
	    	if (nextAxis) {
	    		box1[2] = x
	    	} else {
	    		box1[3] = y
	    	}
	    	draw(from, m-1, nextAxis, depth, box1)

	    	let box2 = box.slice()
	    	if (!axis) {
	    		box2[0] = x
	    	} else {
	    		box2[1] = y
	    	}
	    	draw(m+1, to, nextAxis, depth, box2)
	    }
	}
}



let scatter = createScatter({
  size: 5,
  color: 'rgba(10, 120, 20, .75)',
  borderSize: 1,
  cluster: true,
  borderColor: [.1,.2,.3,1]
})

let settings = createSettings([
	{type: 'number', label: '№ points', min: 1, max: 1e8, log: true, value: 1e6, change: value => {
		let positions = generate(value)
		// let positions = [0,0, 1,1, -1,-1, 1,-1, -1,1, 0,1, 0,-1, 1,0, -1,0]
		// console.time('cluster')
		// cluster(positions)
		// console.timeEnd('cluster')

		// let from = lod[6].offset, to = from + lod[6].count
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
		translate: translate
	})

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
