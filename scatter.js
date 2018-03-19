'use strict'

const rgba = require('color-normalize')
const getBounds = require('array-bounds')
const colorId = require('color-id')
const cluster = require('../point-cluster')
const extend = require('object-assign')
const glslify = require('glslify')
const pick = require('pick-by-alias')
const updateDiff = require('update-diff')
const flatten = require('flatten-vertex-data')
const ie = require('is-iexplorer')
const {float32, fract32} = require('to-float32')
const arrayRange = require('array-range')
const parseRect = require('parse-rect')
const defined = require('defined')

module.exports = Scatter


function Scatter (regl, options) {
	if (!(this instanceof Scatter)) return new Scatter(regl, options)

	if (typeof regl === 'function') {
		if (!options) options = {}
		options.regl = regl
	}
	else {
		options = regl
		regl = null
	}

	if (options && options.length) options.positions = options

	regl = options.regl

	// persistent variables
	let gl = regl._gl,
		drawMarker, drawCircle,
		sizeBuffer, positionBuffer, positionFractBuffer, colorBuffer,
		paletteTexture, palette = [], paletteIds = {},

		// state
		groups = [],

		// textures for marker keys
		markerTextures = [null],
		markerCache = [null]

	const maxColors = 255, maxSize = 100

	// direct color buffer mode
	// IE does not support palette anyways
	let tooManyColors = ie

	// texture with color palette
	paletteTexture = regl.texture({
		data: new Uint8Array(maxColors * 4),
		width: maxColors,
		height: 1,
		type: 'uint8',
		format: 'rgba',
		wrapS: 'clamp',
		wrapT: 'clamp',
		mag: 'nearest',
		min: 'nearest'
	})

	// buffers to reuse
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

	extend(this, {
		regl,
		gl,
		groups,
		markerCache,
		markerTextures,
		palette,
		paletteIds,
		tooManyColors,
		paletteTexture,
		maxColors,
		maxSize,
		positionBuffer,
		positionFractBuffer,
		colorBuffer,
		sizeBuffer,
		canvas: gl.canvas
	})

	// fast-create from existing regl-scatter instance
	if (options.clone) {
		groups = options.clone.groups.map(group => {
			group = extend({}, group)
			if (group.markerIds) {
				group.markerIds = group.markerIds.map(ids => {
					// recreate regl elements here
					let newIds = ids.slice()
					newIds.lod = ids.lod
					newIds.snap = ids.snap
					newIds.data = ids.data
					newIds.id = ids.id
					newIds.elements = regl.elements({
						primitive: 'points',
						type: 'uint32',
						data: ids.data
					})
					return newIds
				})
			}
			return group
		})

		// create marker textures
		options.clone.markers.forEach(markers => {
			addMarker(markers)
		})
		// clone palette texture
		updatePalette(options.clone.palette)
		updateBuffers({point: true, color: true, size: true})
	}
	// full create from options
	else {
		this.update(options)
	}


	// common shader options
	let shaderOptions = {
		uniforms: {
			pixelRatio: regl.context('pixelRatio'),
			palette: paletteTexture,
			paletteSize: (ctx, prop) => [tooManyColors ? 0 : maxColors, paletteTexture.height],
			scale: regl.prop('scale'),
			scaleFract: regl.prop('scaleFract'),
			translate: regl.prop('translate'),
			translateFract: regl.prop('translateFract'),
			opacity: regl.prop('opacity'),
			marker: regl.prop('marker'),
		},

		attributes: {
			x: (ctx, prop) => {
				return prop.xAttr || {
					buffer: positionBuffer,
					stride: 8,
					offset: 0
				}
			},
			y: (ctx, prop) => {
				return prop.yAttr || {
					buffer: positionBuffer,
					stride: 8,
					offset: 4
				}
			},
			xFract: (ctx, prop) => {
				return {
					buffer: positionFractBuffer,
					stride: 8,
					offset: 0
				}
			},
			yFract: (ctx, prop) => {
				return {
					buffer: positionFractBuffer,
					stride: 8,
					offset: 4
				}
			},
			size: (ctx, prop) => prop.size.length ? {
				buffer: sizeBuffer,
				stride: 2,
				offset: 0
			} : {constant: [Math.round(prop.size * 255 / maxSize)]},
			borderSize: (ctx, prop) => prop.borderSize.length ? {
				buffer: sizeBuffer,
				stride: 2,
				offset: 1
			} : {constant: [Math.round(prop.borderSize * 255 / maxSize)]},
			colorId: (ctx, prop) => prop.color.length ? {
				buffer: colorBuffer,
				stride: tooManyColors ? 8 : 4,
				offset: 0
			} : {constant: tooManyColors ? palette.slice(prop.color * 4, prop.color * 4 + 4) : [prop.color]},
			borderColorId: (ctx, prop) => prop.borderColor.length ? {
				buffer: colorBuffer,
				stride: tooManyColors ? 8 : 4,
				offset: tooManyColors ? 4 : 2
			} : {constant: tooManyColors ? palette.slice(prop.borderColor * 4, prop.borderColor * 4 + 4) : [prop.borderColor]}
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
		viewport: regl.prop('viewport'),

		stencil: {enable: false},
		depth: {enable: false},


		elements: regl.prop('elements'),
		count: regl.prop('count'),
		offset: regl.prop('offset'),

		primitive: 'points'
	}

	// draw sdf-marker
	let markerOptions = extend({}, shaderOptions)
	markerOptions.frag = glslify('./marker-frag.glsl')
	markerOptions.vert = glslify('./marker-vert.glsl')

	try {
		this.drawMarker = regl(markerOptions)
	} catch (e) {
	}

	// draw circle
	let circleOptions = extend({}, shaderOptions)
	circleOptions.frag = glslify('./circle-frag.glsl')
	circleOptions.vert = glslify('./circle-vert.glsl')

	// polyfill IE
	if (ie) circleOptions.frag = circleOptions.frag.replace('smoothstep', 'smoothStep')

	this.drawCircle = regl(circleOptions)
}


Scatter.defaults = {
	color: 'black',
	borderColor: 'transparent',
	borderSize: 1,
	size: 12,
	opacity: 1,
	marker: undefined,
	viewport: null,
	range: null,
	pixelSize: null,
	offset: 0,
	count: 0,
	bounds: null,
	positions: [],
	snap: 1e4
}


// update & redraw
Scatter.prototype.render = function (...args) {
	if (args.length) {
		this.update(...args)
	}

	this.draw()

	return this
}


// draw all groups or only indicated ones
Scatter.prototype.draw = function (...args) {
	let { groups } = this

	if (args.length) {
		for (let i = 0; i < args.length; i++) {
			this.drawItem(i, args[i])
		}
	}
	else {
		groups.forEach((group, i) => {
			this.drawItem(i)
		})
	}

	return this
}

// draw specific scatter group
Scatter.prototype.drawItem = function (id, els) {
	let { groups } = this
	let group = groups[id]

	if (typeof els === 'number') {
		id = els
		group = groups[els]
		els = null
	}

	if (!(group && group.count && group.opacity)) return

	// if subset of elements to redraw passed - form a whitelist
	let whitelist
	if (els) {
		whitelist = Array(group.count);

		for (let i = 0; i < els.length; i++) {
			whitelist[els[i]] = true
		}
	}

	// draw circles
	if (group.markerIds[0]) {
		let opts = this.getMarkerDrawOptions(group.markerIds[0], group, whitelist)
		this.drawCircle(opts)
	}

	// draw all other available markers
	let batch = []
	for (let i = 1; i < group.markerIds.length; i++) {
		let ids = group.markerIds[i]

		if (!ids || !ids.length) continue

		[].push.apply(batch, this.getMarkerDrawOptions(ids, group, whitelist))
	}

	if (batch.length) {
		this.drawMarker(batch)
	}
}

// get options for the marker ids
Scatter.prototype.getMarkerDrawOptions = function(ids, group, whitelist) {
	let { range, offset } = group
	let { markerTextures } = this

	// unsnapped options
	if (!ids.snap) {
		let elements = whitelist ? filter(ids.data, whitelist) : ids.elements;

		return [extend({}, group, {
			elements: elements,
			offset: 0,
			count: whitelist ? elements.length : ids.length,
			marker: markerTextures[ids.id]
		})]
	}

	// scales batch
	let batch = []
	let {lod, id} = ids

	let pixelSize = Math.min((range[2] - range[0]) / group.viewport.width, (range[3] - range[1]) / group.viewport.height)

	let offsets = lod.offsets(pixelSize, ...range)

	for (let level = offsets.length; level--;) {
		let [startOffset, endOffset] = offsets[level]
		let items = lod.levels[level]

		// whitelisted level requires subelements from the range
		if (whitelist) {
			// TODO: test this out, prob subrendering is broken
			let elements = filter(ids.data.subarray(startOffset, endOffset), whitelist)

			batch.push(extend({}, group, {
				elements: elements,
				marker: markerTextures[id],
				offset: 0,
				count: elements.length
			}))
		}
		else {
			batch.push(extend({}, group, {
				elements: ids.elements,
				marker: markerTextures[id],
				offset: startOffset + items.offset,
				count: endOffset - startOffset
			}))
		}
	}

	function filter(offsets, whitelist) {
		let subEls = []
		for (let i = 0, l = offsets.length; i < l; i++) {
			let el = offsets[i]
			let id = el - offset
			if (whitelist[id]) {
				subEls.push(el)
			}
		}
		return subEls
	}

	return batch
}

// update groups options
Scatter.prototype.update = function (...args) {
	if (!args.length) return

	// passes are as single array
	if (args.length === 1 && Array.isArray(args[0])) args = args[0]

	// global count of points
	let pointCount = 0, sizeCount = 0, colorCount = 0

	let { groups, gl, regl } = this

	this.groups = groups = args.map((options, i) => {
		let group = groups[i]

		if (options === undefined) return group

		if (options === null) options = { positions: null }
		else if (typeof options === 'function') options = {after: options}
		else if (typeof options[0] === 'number') options = {positions: options}

		// copy options to avoid mutation & handle aliases
		options = pick(options, {
			positions: 'positions data points',
			snap: 'snap cluster',
			size: 'sizes size radius',
			borderSize: 'borderSizes borderSize border-size bordersize borderWidth borderWidths border-width borderwidth stroke-width strokeWidth strokewidth outline',
			color: 'colors color fill fill-color fillColor',
			borderColor: 'borderColors borderColor stroke stroke-color strokeColor',
			marker: 'markers marker shape',
			range: 'range dataBox databox',
			viewport: 'viewport viewPort viewBox viewbox',
			opacity: 'opacity alpha transparency',
			bounds: 'bound bounds boundaries limits'
		})

		if (options.positions === null) options.positions = []

		if (!group) {
			groups[i] = group = {
				id: i,
				scale: null,
				translate: null,
				scaleFract: null,
				translateFract: null,

				// list of ids corresponding to markers, with inner props
				markerIds: []
			}
			options = extend({}, Scatter.defaults, options)
		}

		// force update triggers
		if (options.positions && !('marker' in options)) {
			options.marker = group.marker
			delete group.marker
		}

		// updating markers cause recalculating snapping
		if (options.marker && !('positions' in options)) {
			options.positions = group.positions
			delete group.positions
		}

		updateDiff(group, options, [{
			snap: true,
			size: s => {
				if (!defined(s)) s = Scatter.defaults.size
				sizeCount += s && s.length ? 1 : 0
				return s
			},
			borderSize: s => {
				if (!defined(s)) s = Scatter.defaults.borderSize
				sizeCount += s && s.length ? 1 : 0
				return s
			},
			opacity: parseFloat,

			// add colors to palette, save references
			color: (c, group) => {
				if (!defined(c)) c = Scatter.defaults.color
				c = this.updateColor(c)
				colorCount++
				return c
			},
			borderColor: (c, group) => {
				if (!defined(c)) c = Scatter.defaults.borderColor
				c = this.updateColor(c)
				colorCount++
				return c
			},

			bounds: (bounds, group, options) => {
				if (!('range' in options)) options.range = null
				return bounds
			},

			positions: (positions, group, options) => {
				// separate buffers for x/y coordinates
				if (positions.x || positions.y) {
					if (positions.x.length) {
						group.xAttr = {
							buffer: regl.buffer(positions.x),
							offset: 0,
							stride: 4,
							count: positions.x.length
						}
					}
					else {
						group.xAttr = {
							buffer: positions.x.buffer,
							offset: positions.x.offset * 4 || 0,
							stride: (positions.x.stride || 1) * 4,
							count: positions.x.count
						}
					}
					if (positions.y.length) {
						group.yAttr = {
							buffer: regl.buffer(positions.y),
							offset: 0,
							stride: 4,
							count: positions.y.length
						}
					}
					else {
						group.yAttr = {
							buffer: positions.y.buffer,
							offset: positions.y.offset * 4 || 0,
							stride: (positions.y.stride || 1) * 4,
							count: positions.y.count
						}
					}
					group.count = Math.max(group.xAttr.count, group.yAttr.count)
					group.offset = 0
					pointCount += group.count

					return positions
				}

				positions = flatten(positions, 'float64')

				let count = group.count = Math.floor(positions.length / 2)
				let bounds = group.bounds = count ? getBounds(positions, 2) : null

				// if range is not provided updated - recalc it
				if (!options.range && !group.range) {
					delete group.range
					options.range = bounds
				}

				group.offset = pointCount
				pointCount += count

				// reset marker
				if (!options.marker && !group.marker) {
					delete group.marker;
					options.marker = null;
				}

				return positions
			}
		}, {
			// create marker ids corresponding to known marker textures
			marker: (markers, group, options) => {
				// reset marker elements
				group.markerIds.length = 0

				// single sdf marker
				if (!markers || typeof markers[0] === 'number') {
					let id = this.addMarker(markers)

					let elements = arrayRange(group.count)

					group.markerIds[id] = elements
				}
				// per-point markers
				else {
					for (let i = 0, l = Math.min(markers.length, group.count); i < l; i++) {
						let id = this.addMarker(markers[i])

						if (!group.markerIds[id]) group.markerIds[id] = []
						group.markerIds[id].push(i)
					}
				}

				return markers
			}
		}, {
			// recalculate per-marker snapping
			// first, it is faster to snap 100 points 100 times than 10000 points once (practically, not theoretically)
			// second, it is easier to subset render per-marker than per-generic set
			positions: (positions, group) => {
				if (!positions || !positions.length) return

				let {markerIds, snap, bounds, offset} = group

				for (let i = 0; i < markerIds.length; i++) {
					let ids = markerIds[i]
					if (!ids || !ids.length) continue

					let l = ids.length, els

					ids.id = i;

					if (snap && (snap === true || l > snap)) {
						ids.snap = true
						let markerPoints

						// multimarker snapping is computationally more intense
						if (markerIds.length > 1) {
							markerPoints = Array(l * 2)

							for (let i = 0; i < l; i++) {
								let id = ids[i]
								markerPoints[i * 2] = positions[id * 2]
								markerPoints[i * 2 + 1] = positions[id * 2 + 1]
							}
						}
						else {
							markerPoints = new Float64Array(positions.length)
							markerPoints.set(positions)
						}

						ids.lod = cluster(markerPoints, { bounds })

						// augment levels offset params
						els = new Uint32Array(l)
						for (let level = 0, off = 0; level < ids.lod.levels.length; level++) {
							let items = ids.lod.levels[level],
								l = items.length
							for (let i = 0; i < l; i++) {
								let id = items[i], iid = ids[id]
								els[i + off] = iid + offset
							}
							items.offset = off
							off += l
						}
					}
					else {
						els = new Uint32Array(l)
						for (let i = 0; i < l; i++) {
							els[i] = ids[i] + offset
						}
					}

					ids.data = els;

					ids.elements = regl.elements({
						primitive: 'points',
						type: 'uint32',
						data: els
					})
				}
			},

			range: (range, group, options) => {
				let bounds = group.bounds

				// FIXME: why do we need this?
				if (!bounds) return
				if (!range) range = bounds

				group.scale = [1 / (range[2] - range[0]), 1 / (range[3] - range[1])]
				group.translate = [-range[0], -range[1]]

				group.scaleFract = fract32(group.scale)
				group.translateFract = fract32(group.translate)

				return range
			},

			viewport: vp => {
				let rect = parseRect(vp || [
					gl.drawingBufferWidth,
					gl.drawingBufferHeight
				])

				// normalize viewport to the canvas coordinates
				// rect.y = gl.drawingBufferHeight - rect.height - rect.y

				return rect
			}
		}])

		return group
	})

	this.updateBuffers({
		point: pointCount,
		size: sizeCount,
		color: colorCount
	})
}

// update buffers data based on existing groups
Scatter.prototype.updateBuffers = function({point, size, color}) {
	let { paletteIds, palette, groups, tooManyColors, colorBuffer, positionBuffer, positionFractBuffer, maxColors, maxSize, sizeBuffer } = this

	// put point/color data into buffers, if updated any of them
	let len = groups.reduce((acc, group, i) => {
		return acc + (group ? group.count : 0)
	}, 0)

	if (point) {
		let positionData = new Float32Array(len * 2)
		let positionFractData = new Float32Array(len * 2)

		groups.forEach((group, i) => {
			if (!group) return
			let {positions, count, offset} = group
			if (!count) return
			positionData.set(float32(positions), offset * 2)
			positionFractData.set(fract32(positions), offset * 2)
		})

		positionBuffer(positionData)
		positionFractBuffer(positionFractData)
	}

	if (size) {
		let sizeData = new Uint8Array(len * 2)

		groups.forEach((group, i) => {
			if (!group) return
			let { count, offset, size, borderSize } = group
			if (!count) return

			if (size.length || borderSize.length) {
				let sizes = new Uint8Array(count*2)
				for (let i = 0; i < count; i++) {
					// we downscale size to allow for fractions
					sizes[i*2] = Math.round((size[i] == null ? size : size[i]) * 255 / maxSize)
					sizes[i*2 + 1] = Math.round((borderSize[i] == null ? borderSize : borderSize[i]) * 255 / maxSize)
				}
				sizeData.set(sizes, offset * 2)
			}
		})
		sizeBuffer(sizeData)
	}

	if (color) {
		let colorData

		// if too many colors - put colors to buffer directly
		if (tooManyColors) {
			colorData = new Uint8Array(len * 8)

			groups.forEach((group, i) => {
				if (!group) return
				let {count, offset, color, borderColor} = group
				if (!count) return

				if (color.length || borderColor.length) {
					let colors = new Uint8Array(count * 8)
					for (let i = 0; i < count; i++) {
						let colorId = color[i]
						colors[i*8] = palette[colorId*4]
						colors[i*8 + 1] = palette[colorId*4 + 1]
						colors[i*8 + 2] = palette[colorId*4 + 2]
						colors[i*8 + 3] = palette[colorId*4 + 3]

						let borderColorId = borderColor[i]
						colors[i*8 + 4] = palette[borderColorId*4]
						colors[i*8 + 5] = palette[borderColorId*4 + 1]
						colors[i*8 + 6] = palette[borderColorId*4 + 2]
						colors[i*8 + 7] = palette[borderColorId*4 + 3]
					}

					colorData.set(colors, offset * 8)
				}
			})
		}

		// if limited amount of colors - keep palette color picking
		// that saves significant memory
		else {
			colorData = new Uint8Array(len * 4)

			groups.forEach((group, i) => {
				if (!group) return
				let {count, offset, color, borderColor} = group
				if (!count) return

				if (color.length || borderColor.length) {
					let colorIds = new Uint8Array(count * 4)
					for (let i = 0; i < count; i++) {
						// put color coords in palette texture
						if (color[i] != null) {
							colorIds[i*4] = color[i] % maxColors
							colorIds[i*4 + 1] = Math.floor(color[i] / maxColors)
						}
						if (borderColor[i] != null) {
							colorIds[i*4 + 2] = borderColor[i] % maxColors
							colorIds[i*4 + 3] = Math.floor(borderColor[i] / maxColors)
						}
					}

					colorData.set(colorIds, offset * 4)
				}
			})
		}

		colorBuffer(colorData)
	}
}

// get (and create) marker texture id
Scatter.prototype.addMarker = function (sdf) {
	let { markerTextures, regl, markerCache } = this

	let pos = sdf == null ? 0 : markerCache.indexOf(sdf)

	if (pos >= 0) return pos

	// convert sdf to 0..255 range
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

// register color to palette, return it's index or list of indexes
Scatter.prototype.updateColor = function (colors) {
	let { paletteIds, palette, tooManyColors, maxColors } = this

	if (!Array.isArray(colors)) {
		colors = [colors]
	}

	let idx = []

	// if color groups - flatten them
	if (typeof colors[0] === 'number') {
		let grouped = []

		if (Array.isArray(colors)) {
			for (let i = 0; i < colors.length; i+=4) {
				grouped.push(colors.slice(i, i+4))
			}
		}
		else {
			for (let i = 0; i < colors.length; i+=4) {
				grouped.push(colors.subarray(i, i+4))
			}
		}

		colors = grouped
	}

	for (let i = 0; i < colors.length; i++) {
		let color = colors[i]

		color = rgba(color, 'uint8')

		let id = colorId(color, false)

		// if new color - save it
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

	// detect if too many colors in palette
	if (!tooManyColors && palette.length > maxColors * maxColors * 4) tooManyColors = true

	// limit max color
	this.updatePalette(palette)

	// keep static index for single-color property
	return idx.length === 1 ? idx[0] : idx
}

Scatter.prototype.updatePalette = function(palette) {
	if (this.tooManyColors) return

	let { maxColors, paletteTexture } = this

	let requiredHeight = Math.ceil(palette.length * .25 / maxColors)

	// pad data
	if (requiredHeight > 1) {
		palette = palette.slice()
		for (let i = (palette.length * .25) % maxColors; i < requiredHeight * maxColors; i++) {
			palette.push(0, 0, 0, 0)
		}
	}

	// ensure height
	if (paletteTexture.height < requiredHeight) {
		paletteTexture.resize(maxColors, requiredHeight)
	}

	// update full data
	paletteTexture.subimage({
		width: Math.min(palette.length * .25, maxColors),
		height: requiredHeight,
		data: palette
	}, 0, 0)
}

// remove unused stuff
Scatter.prototype.destroy = function () {
	groups.length = 0

	sizeBuffer.destroy()
	positionBuffer.destroy()
	positionFractBuffer.destroy()
	colorBuffer.destroy()
	paletteTexture.destroy()
}
