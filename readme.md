# regl-scatter2d [![experimental](https://img.shields.io/badge/stability-unstable-green.svg)](http://github.com/badges/stability-badges)

Scatter plot for lots of points.

![regl-scatter2d](https://github.com/dfcreative/regl-scatter2d/blob/master/preview.png?raw=true)

Remake on [gl-scatter2d](https://github.com/gl-vis/gl-scatter2d), covering other scatter-related components.

[Demo](https://dfcreative.github.io/regl-scatter2d).


## Usage

[![npm install regl-scatter2d](https://nodei.co/npm/regl-scatter2d.png?mini=true)](https://npmjs.org/package/regl-scatter2d/)

```js
let regl = require('regl')({extensions: 'oes_element_index_uint'})

let createScatter = require('regl-scatter2d')

let scatter = createScatter(regl)

//draw 5 points
scatter({
  positions: [0,0, 1,0, 2,0, 1,1, 2,1],
  color: 'rgba(0, 100, 200, .75)'
})
```

### `createScatter(regl, options?)`

Create new scatter plot instance from `regl` and initial `options`. Note that `regl` instance should have `OES_element_index_uint` extension enabled.

### `scatter(options|list?)`

Draw scatter points, update options.

Option | Default | Description
---|---|---
`positions`, `points` | `[]` | An array of the unrolled xy coordinates of the points as `[x,y, x,y, ...]` or array of points `[[x,y], [x,y], ...]`.
`size`, `sizes` | `12` | Number or array with marker sizes in pixels. Array length should correspond to `positions`.
`borderSize`, `borderSizes` | `1` | Number or array with border sizes in pixels. Array length should correspond to `positions`.
`color`, `colors` | `'black'` | Color or array with colors. Each color can be a css color string or an array with float `0..1` values.
`borderColor`, `borderColors` | `'transparent'` | Border color or array with border colors.
`opacity` | `1` | Regulate marker transparency separately from colors.
`marker`, `markers` | `null` | Marker SDF image, should be a rectangular array with `0..1` 1-channel values of signed distance field. Use [bitmap-sdf](https://github.com/dfcreative/bitmap-sdf) or [svg-path-sdf](https://github.com/dfcreative/svg-path-sdf) to generate distance array from a canvas, image or svg. `.5` value of distance corresponds to the border line. If `null`, circular marker is used.
`range`, `dataBox` | `null` | Data bounds limiting visible data as `[left, top, right, bottom]`. If `null`, the range is detected as `positions` boundaries.
`viewport`, `viewBox` | `null` | Bounding box limiting visible area within the canvas in pixels, can be an array `[left, top, right, bottom]` or an object `{left|x, top|y, width|bottom, height|right}`.
`snap` | `1e5` | Number of points threshold to enable snapping, can be bool. See [snap-points-2d](https://github.com/gl-vis/snap-points-2d).
`ids`, `elements` | `null` | Subset of `points` to draw, should be an array of point ids. If `undefined`, all available points are drawn.
<!-- `draw` | `true` | Redraw points. If `false`, options will be updated but no points drawn. If `'pick'`, the numeric indices will be drawn instead of colors. -->

A list of options can be passed for batch rendering:

```js
//draw multiple point groups
scatter([
  {points: [0,0, 1,1], color: 'blue', marker: null},
  {points: [0,1, 1,0], color: 'red', marker: someSdf}
])
```

### `scatter.update(options|list)`

Update options, not incurring redraw.

### `scatter.draw(id?)`

Draw points based on last options. `id` integer can specify a scatter group to redraw defined via batch update.

### `scatter.destroy()`

Dispose scatter instance and associated resources.

## Related

* [regl-line2d](https://github.com/dfcreative/regl-line2d)
* [regl-error2d](https://github.com/dfcreative/regl-error2d)

## Similar

* [pts](https://github.com/williamngan/pts)

## License

(c) 2017 Dima Yv. MIT License

Development supported by [plot.ly](https://github.com/plotly/).
