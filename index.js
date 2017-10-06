'use strict'

const createRegl = require('regl')
const rgba = require('color-rgba')
const getBounds = require('array-bounds')
const colorId = require('color-id')
const snapPoints = require('snap-points-2d')
const extend = require('object-assign')
const glslify = require('glslify')
const search = require('binary-search-bounds')
const pick = require('pick-by-alias')
const updateDiff = require('update-diff')
const flatten = require('flatten-vertex-data')

module.exports = Scatter


function Scatter (options) {
	if (!options) options = {}
	else if (typeof options === 'function') options = {regl: options}

	// persistent variables
	let regl, gl,
		size,
		drawMarker, drawCircle,
		sizeBuffer, positionBuffer, positionFractBuffer, colorBuffer,
		paletteTexture, palette = [], paletteIds = {},
		defaultOptions = {
			color: 'black',
			borderColor: 'transparent',
			borderSize: 1,
			size: 12,
			opacity: 1,
			marker: null,
			viewport: null,
			range: null,
			pixelSize: null,
			offset: 0,
			count: 0,
			bounds: null,
			positions: null,
			snap: 1e4
		},
		groups = [],

		//textures for marker keys
		markerTextures = [null],
		markerCache = [null]

	const maxColors = 256, maxSize = 100

	// regl instance
	if (options.regl) regl = options.regl

	// container/gl/canvas case
	else {
		let opts

		if (options instanceof HTMLCanvasElement) opts = {canvas: options}
		else if (options instanceof HTMLElement) opts = {container: options}
		else if (options.drawingBufferWidth || options.drawingBufferHeight) opts = {gl: options}

		else {
			opts = pick(options, 'pixelRatio canvas container gl extensions')
		}

		if (!opts.optionalExtensions) opts.optionalExtensions = []

		opts.optionalExtensions.push('OES_element_index_uint')

		//FIXME: fallback to Int16Array if extension is not supported
		regl = createRegl(opts)
	}

	//TODO: test if required extensions are supported

	gl = regl._gl

	//texture with color palette
	paletteTexture = regl.texture({
		width: maxColors,
		height: 1,
		type: 'uint8',
		format: 'rgba',
		mag: 'nearest',
		min: 'nearest'
	})

	//buffers to reuse
	sizeBuffer = regl.buffer({
		usage: 'dynamic',
		type: 'float',
		data: null
	})
	colorBuffer = regl.buffer({
		usage: 'dynamic',
		type: 'uint8',
		data: null
	})
	positionBuffer = regl.buffer({
		usage: 'dynamic',
		type: 'float',
		data: null
	})
	positionFractBuffer = regl.buffer({
		usage: 'dynamic',
		type: 'float',
		data: null
	})

	//init defaults
	update(options)


	//common shader options
	let shaderOptions = {
		uniforms: {
			pixelRatio: regl.context('pixelRatio'),
			palette: paletteTexture,
			scale: regl.prop('scale'),
			scaleFract: regl.prop('scaleFract'),
			translate: regl.prop('translate'),
			translateFract: regl.prop('translateFract'),
			opacity: regl.prop('opacity'),
			marker: regl.prop('marker')
		},

		attributes: {
			position: positionBuffer,
			positionFract: positionFractBuffer,
			size: {
				buffer: sizeBuffer,
				stride: 2,
				offset: 0
			},
			borderSize: {
				buffer: sizeBuffer,
				stride: 2,
				offset: 1
			},
			colorId: {
				buffer: colorBuffer,
				stride: 2,
				offset: 0
			},
			borderColorId: {
				buffer: colorBuffer,
				stride: 2,
				offset: 1
			}
		},

		blend: {
			enable: true,
			color: [0,0,0,1],
			func: {
				srcRGB: 'src alpha',
				dstRGB: 'one minus src alpha',
				srcAlpha: 'one minus dst alpha',
				dstAlpha: 'one'
			}
		},

		scissor: {
			enable: true,
			box: regl.prop('viewport')
		},
		stencil: false,
		viewport: regl.prop('viewport'),

		depth: {
			enable: false
		},

		elements: regl.prop('elements'),
		count: regl.prop('count'),
		offset: regl.prop('offset'),

		primitive: 'points'
	}

	//draw sdf-marker
	let markerOptions = extend({}, shaderOptions)
	markerOptions.frag = glslify('./marker-frag.glsl')
	markerOptions.vert = glslify('./marker-vert.glsl')

	drawMarker = regl(markerOptions)

	//draw circle
	let circleOptions = extend({}, shaderOptions)
	circleOptions.frag = glslify('./circle-frag.glsl')
	circleOptions.vert = glslify('./circle-vert.glsl')

	drawCircle = regl(circleOptions)

	//expose API
	extend(scatter2d, {
		update: update,
		draw: draw,
		destroy: destroy,
		regl: regl,
		gl: gl,
		canvas: gl.canvas,
		groups: groups
	})


	function scatter2d (opts) {
		//update
		if (opts) {
			update(opts)
		}

		//destroy
		else if (opts === null) {
			destroy()
		}

		draw(opts)
	}

	function draw (opts) {
		//make options a batch
		if (opts && !Array.isArray(opts)) opts = [opts]
		groups.filter(group => group && group.count && group.opacity)
			.forEach((group, i) => {
			if (opts) {
				if (!opts[i]) group.draw = false
				else group.draw = true
			}

			//ignore draw flag for one pass
			if (!group.draw) {
				group.draw = true;
				return
			}

			//draw subset of elements
			if (opts && opts[i] && (opts[i].elements || opts[i].ids)) {
				let els = opts[i].elements || opts[i].ids

				let pending = {};

				for (let i = 0; i < els.length; i++) {
					pending[els[i]] = true;
				}

				let batch = []
				for (let i = 0; i < group.markerIds.length; i++) {
					let subIds = [], ids = group.markerIds[i]

					for (let i = 0, l = ids.length; i < l; i++) {
						if (pending[ids[i]]) {
							subIds.push(ids[i])
							pending[ids[i]] = null
						}
					}

					batch.push({
						elements: subIds,
						offset: 0,
						count: subIds.length,
						marker: ids.id
					})
				}

			    regl._refresh()
				drawCircle(batch.shift())
			    regl._refresh()
				drawMarker(batch)

				return
			}


			//draw circles
			//FIXME remove regl._refresh hooks once regl issue #427 is fixed
			if (group.markerIds[0]) {
				regl._refresh()
				console.log(group)
				drawCircle(getMarkerDrawOptions(group.markerIds[0], group))
			}

			//draw all other available markers
			let batch = []
			for (let i = 1; i < group.markerIds.length; i++) {
				let ids = group.markerIds[i]
				console.log(group)

				if (!ids || !ids.length) continue

				batch.push(getMarkerDrawOptions(ids, group))
			}

			if (batch.length) {
				regl._refresh()
				drawMarker(batch)
			}
		})
	}

	//get options for the marker ids
	function getMarkerDrawOptions(ids, group) {
		//unsnapped options
		if (!ids.snap) {
			return extend({}, group, {
				elements: ids.elements,
				offset: 0,
				count: ids.length,
				marker: markerTextures[ids.id]
			})
		}

		//scales batch
		let batch = []
		let {range} = group
		let {lod, x, w, id} = ids

		let els = ids.elements

		for (let scaleNum = lod.length; scaleNum--;) {
			let level = lod[scaleNum]

			//FIXME: use minSize-adaptive coeff here, if makes sense, mb we need dist tho
			if (level.pixelSize && level.pixelSize < ids.pixelSize && scaleNum > 1) continue

			let intervalStart = level.offset
			let intervalEnd = level.count + intervalStart

			let startOffset = search.ge(x, range[0], intervalStart, intervalEnd - 1)
			let endOffset = search.lt(x, range[2], startOffset, intervalEnd - 1) + 1

			if (endOffset <= startOffset) continue

			batch.push(extend({}, group, {
				elements: els,
				marker: markerTextures[id],
				offset: startOffset,
				count: endOffset - startOffset
			}))
		}

		return batch
	}

	function update (options) {
		//direct points argument
		if (options.length != null) {
			if (typeof options[0] === 'number') options = {positions: options}
		}

		//make options a batch
		if (!Array.isArray(options)) options = [options]

		//global count of points
		let pointCount = 0, colorCount = 0

		groups = options.map((options, i) => {
			let group = groups[i]

			if (typeof options === 'function') options = {after: options}
			else if (typeof options[0] === 'number') options = {positions: options}

			//copy options to avoid mutation & handle aliases
			options = pick(options, {
				positions: 'positions data points',
				snap: 'snap cluster',
				size: 'sizes size radius',
				borderSize: 'borderSizes borderSize stroke-width strokeWidth outline',
				color: 'colors color fill fill-color fillColor',
				borderColor: 'borderColors borderColor stroke stroke-color strokeColor',
				palette: 'palette swatch',
				marker: 'markers marker shape',
				range: 'range dataBox',
				viewport: 'viewport viewBox',
				precise: 'precise hiprecision',
				opacity: 'opacity alpha'
			})

			if (!group) {
				groups[i] = group = {
					id: i,
					scale: null,
					translate: null,
					scaleFract: null,
					translateFract: null,
					draw: true,

					//list of ids corresponding to markers, with inner props
					markerIds: []
				}
				options = extend({}, defaultOptions, options)
			}

			updateDiff(group, options, [{
				precise: Boolean,
				snap: s => s === true ? 1e4 : s === false ? Infinity : s,
				size: true,
				borderSize: true,
				opacity: parseFloat,

				//add colors to palette, save references
				color: c => {
					c = updateColor(c)
					colorCount += typeof c === 'number' ? c : c.length
					return c
				},
				borderColor: c => {
					c = updateColor(c)
					colorCount += typeof c === 'number' ? c : c.length
					return c
				},

				positions: (positions, group) => {
					positions = flatten(positions, 'float64')

					let count = group.count = Math.floor(positions.length / 2)
					let bounds = group.bounds = getBounds(positions, 2)

					//grouped positions
					let points = Array(count)
					for (let i = 0; i < count; i++) {
						points[i] = [
							positions[i*2],
							positions[i*2+1]
						]
					}
					group.points = points

					if (!group.range) group.range = bounds

					group.offset = pointCount
					pointCount += count

					return positions
				}
			}, {
				//create marker ids corresponding to known marker textures
				marker: (markers, group, options) => {
					//reset marker elements
					group.markerIds.length = 0

					//single sdf marker
					if (!markers || typeof markers[0] === 'number') {
						let elements = Array(group.count)
						for (let i = 0; i < group.count; i++) {
							elements[i] = i + group.offset
						}

						let id = addMarker(markers)
						group.markerIds[id] = elements
					}
					//per-point markers
					else {
						for (let i = 0, l = markers.length; i < l; i++) {
							let id = addMarker(markers[i])

							if (!group.markerIds[id]) group.markerIds[id] = []
							group.markerIds[id].push(i)
						}
					}

					return markers
				},
			}, {
				//recalculate per-marker snapping
				//first, it is faster to snap 100 points 100 times than 10000 points once (practically, not theoretically)
				//second, it is easier to subset render per-marker than per-generic set
				positions: (positions, group) => {
					let {markerIds, snap, bounds} = group

					for (let i = 0; i < markerIds.length; i++) {
						let ids = markerIds[i]
						if (!ids || !ids.length) continue

						let l = ids.length

						ids.id = i;

						if (l * 2 > snap) {
							ids.snap = true
							let x = ids.x = Array(l)
							let w = ids.w = Array(l)
							let markerPoints = Array(l * 2)

							//shuffled_id: real_id
							let i2id = Array(l)

							for (let i = 0; i < l; i++) {
								let id = ids[i]
								markerPoints[i * 2] = positions[id * 2]
								markerPoints[i * 2 + 1] = positions[id * 2 + 1]
							}

							ids.lod = snapPoints(markerPoints, i2id, w, bounds)

							let idx = Array(l)
							for (let i = 0; i < l; i++) {
								let id = i2id[i]
								idx[i] = ids[id]
								x[i] = positions[ids[id] * 2]
							}

							//put shuffled → direct element ids to memory
							ids.elements = regl.elements({
								primitive: 'points',
								type: 'uint32',
								data: idx
							})
						}

						//direct elements
						else {
							ids.elements = regl.elements({
								primitive: 'points',
								type: 'uint32',
								data: ids
							})
						}
					}
				},

				range: (range, group, options) => {
					let bounds = group.bounds
					if (!range) range = bounds

					group.scale = [1 / (range[2] - range[0]), 1 / (range[3] - range[1])]
					group.translate = [-range[0], -range[1]]

					group.scaleFract = fract32(group.scale)
					group.translateFract = fract32(group.translate)

					return range
				},

				viewport: vp => {
					let viewport

					if (Array.isArray(vp)) {
						viewport = {
							x: vp[0],
							y: vp[1],
							width: vp[2] - vp[0],
							height: vp[3] - vp[1]
						}
					}
					else if (vp) {
						viewport = {
							x: vp.x || vp.left || 0,
							y: vp.y || vp.top || 0
						}

						if (vp.right) viewport.width = vp.right - viewport.x
						else viewport.width = vp.w || vp.width || 0

						if (vp.bottom) viewport.height = vp.bottom - viewport.y
						else viewport.height = vp.h || vp.height || 0
					}
					else {
						viewport = {
							x: 0, y: 0,
							width: gl.drawingBufferWidth,
							height: gl.drawingBufferHeight
						}
					}

					return viewport
				}
			}])

			return group
		})

		//put point/color data into buffers, if updated any of them
		if (pointCount || colorCount) {
			let len = groups.reduce((acc, group, i) => {
				return acc + group.count
			}, 0)

			let positionData = new Float64Array(len * 2)
			let colorData = new Uint8Array(len * 2)
			let sizeData = new Uint8Array(len * 2)

			groups.forEach((group, i) => {
				let {positions, count, offset, color, borderColor, size, borderSize} = group
				if (!count) return

				let colorId = new Uint8Array(count*2)
				let sizes = new Uint8Array(count*2)
				for (let i = 0; i < count; i++) {
					colorId[i*2] = color[i] == null ? color : color[i]
					colorId[i*2 + 1] = borderColor[i] == null ? borderColor : borderColor[i]

					//we downscale size to allow for fractions
					sizes[i*2] = (size[i] == null ? size : size[i]) * 255 / maxSize
					sizes[i*2 + 1] = (borderSize[i] == null ? borderSize : borderSize[i]) * 255 / maxSize
				}

				positionData.set(positions, offset * 2)
				colorData.set(colorId, offset * 2)
				sizeData.set(sizes, offset * 2)
			})

			positionBuffer(float32(positionData))
			positionFractBuffer(fract32(positionData))
			colorBuffer(colorData)
			sizeBuffer(sizeData)
		}
	}

	//get (and create) marker texture id
	function addMarker (sdf) {
		let pos = sdf == null ? 0 : markerCache.indexOf(sdf)

		if (pos >= 0) return pos

		//convert sdf to 0..255 range
		let distArr
		if (sdf instanceof Uint8Array || sdf instanceof Uint8ClampedArray) {
			distArr = sdf
		}
		else {
			distArr = new Uint8Array(sdf.length)
			for (let i = 0, l = sdf.length; i < l; i++) {
				distArr[i] = sdf[i] * 255
			}
		}

		let radius = Math.floor(Math.sqrt(distArr.length))

		pos = markerTextures.length

		markerCache.push(sdf)
		markerTextures.push(regl.texture({
			channels: 1,
			data: distArr,
			radius: radius,
			mag: 'linear',
			min: 'linear'
		}))

		return pos
	}

	//register color to palette, return it's index or list of indexes
	function updateColor (colors) {
		if (!Array.isArray(colors)) {
			colors = [colors]
		}

		let start = palette.length
		let idx = []
		for (let i = 0; i < colors.length; i++) {
			let color = colors[i]

			//idx colors
			if (typeof color === 'number') {
				idx[i] = color
				continue
			}

			if (typeof color === 'string') {
				color = rgba(color, false)
				color[3] *= 255;
				color = color.map(Math.floor)
			}
			else if (Array.isArray(color)) {
				color = color.map(Math.floor)
			}
			else if (color instanceof Float32Array) {
				color[0] = Math.floor(color[0] * 255)
				color[1] = Math.floor(color[1] * 255)
				color[2] = Math.floor(color[2] * 255)
				color[3] = Math.floor(color[3] * 255)
			}
			else {
				color = [127, 127, 127, 127]
			}

			let id = colorId(color, false)
			if (paletteIds[id] == null) {
				let pos = palette.length
				paletteIds[id] = Math.floor(pos / 4)
				palette[pos] = color[0]
				palette[pos+1] = color[1]
				palette[pos+2] = color[2]
				palette[pos+3] = color[3]
			}
			idx[i] = paletteIds[id]
		}

		let w = (palette.length - start) * .25
		if (w > 0) {
			paletteTexture.subimage({
				width: w,
				height: 1,
				data: palette.slice(start)
			}, start * .25, 0)
		}

		//keep static index for single-color property
		return idx.length === 1 ? idx[0] : idx
	}

	function destroy () {
		sizeBuffer.destroy()
		positionBuffer.destroy()
		positionFractBuffer.destroy()
		colorBuffer.destroy()
		borderColorBuffer.destroy()
		borderSizeBuffer.destroy()
		paletteTexture.destroy()
		regl.destroy()
	}

	return scatter2d
}

//return fractional part of float32 array
function fract32 (arr) {
	let fract = new Float32Array(arr.length)
	fract.set(arr)
	for (let i = 0, l = fract.length; i < l; i++) {
		fract[i] = arr[i] - fract[i]
	}
	return fract
}
function float32 (arr) {
	if (arr instanceof Float32Array) return arr

	let float = new Float32Array(arr)
	float.set(arr)
	return float
}
