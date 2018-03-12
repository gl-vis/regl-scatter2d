'use strict'

let Scatter = require('./scatter')
let extend = require('object-assign')

module.exports = function (regl, options) {
	let scatter = new Scatter(regl, options)

	let render = scatter.render.bind(scatter)

	// expose API
	extend(render, {
		render: scatter.render,
		update: scatter.update,
		updateItem: scatter.updateItem,
		draw: scatter.draw,
		drawItem: scatter.drawItem,
		destroy: scatter.destroy,
		regl: scatter.regl,
		gl: scatter.gl,
		canvas: scatter.gl.canvas,
		groups: scatter.groups,
		markers: scatter.markerCache,
		palette: scatter.palette
	})

	return render
}
