'use strict'

let Scatter = require('./scatter')
let extend = require('object-assign')

module.exports = function (regl, options) {
	let scatter = new Scatter(regl, options)

	// expose API
	extend(scatter2d, {
		update: scatter.update,
		draw: scatter.draw,
		destroy: scatter.destroy,
		regl: scatter.regl,
		gl: scatter.gl,
		canvas: scatter.gl.canvas,
		groups: scatter.groups,
		markers: scatter.markerCache,
		palette: scatter.palette
	})

	function scatter2d (opts) {
		// update
		if (opts) {
			scatter.update(opts)
		}

		// destroy
		else if (opts === null) {
			scatter.destroy()
		}

		scatter.draw()
	}

	return scatter2d
}
