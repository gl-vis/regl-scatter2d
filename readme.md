# regl-scatter2d [![experimental](https://img.shields.io/badge/stability-unstable-green.svg)](http://github.com/badges/stability-badges)

Scatter plot for lots of points.

![regl-scatter2d](https://github.com/dfcreative/regl-scatter2d/blob/master/preview.png?raw=true)

Remake on [gl-scatter2d](https://github.com/gl-vis/gl-scatter2d), covering other scatter-related components.

[Demo](https://dfcreative.github.io/regl-scatter2d).


## Usage

[![npm install regl-scatter2d](https://nodei.co/npm/regl-scatter2d.png?mini=true)](https://npmjs.org/package/regl-scatter2d/)

```js
let drawPoints = require('regl-scatter2d')(require('regl')())

//draw 5 points
drawPoints({
  positions: [0,0, 1,0, 2,0, 1,1, 2,1],
  color: 'rgba(0, 100, 200, .75)'
})

//draw multiple point groups
drawPoints([
  {points: [0,0, 1,1], color: 'blue', marker: null},
  {points: [0,1, 1,0], color: 'red', marker: someSdf}
])

//redraw the second group
drawPoints([false, true])

//redraw both groups
drawPoints()
```

## API

### `scatter = require('regl-scatter2d')(regl|options?)`

Create function drawing points, based on options or a shortcut.

Option | Default | Description
---|---|---
`regl` | `null` | Regl instance to reuse, otherwise new regl is created.
`gl`, `canvas`, `container`, `pixelRatio` | `null` | Options for `regl`, if new regl is created.

Rest of options initialize `scatter`.

### `scatter(points|options|list?)`

Redraw points and update options. To make multipass rendering, pass a list with options for every separate scatter group.

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
`precise` | `false` | Reduces max number of points and performance a bit, but enables 64-bit float precision.
`snap` | `1e5` | Number of points threshold to enable snapping, can be bool.
`ids`, `elements` | `null` | Subset of `points` to draw, should be an array of point ids. If `undefined`, all available points are drawn.
<!-- `draw` | `true` | Redraw points. If `false`, options will be updated but no points drawn. If `'pick'`, the numeric indices will be drawn instead of colors. -->

Separate methods are exposed `scatter.update`, `scatter.draw`, `scatter.destroy`.

## Related

* [regl-line2d](https://github.com/dfcreative/regl-line2d)
* [regl-error2d](https://github.com/dfcreative/regl-error2d)
* [pts](https://github.com/williamngan/pts)

## License

(c) 2017 Dima Yv. MIT License

Development supported by [plot.ly](https://github.com/plotly/).
