# regl-scatter2d [![experimental](https://img.shields.io/badge/stability-unstable-green.svg)](http://github.com/badges/stability-badges)

Scatter plot for lots of points.

Remake on [gl-scatter2d](https://github.com/gl-vis/gl-scatter2d), [gl-scatter2d-fancy](https://github.com/gl-vis/gl-scatter2d-fancy) and [gl-scatter2d-sdf](https://github.com/gl-vis/gl-scatter2d-sdf).

Demos:

* [points](https://dfcreative.github.com/regl-scatter2d)
* [colors/sizes](https://dfcreative.github.com/regl-scatter2d/colors)

<!--
* [point-cluster](https://github.com/dfcreative/point-cluster) is used instead of [snap-points-2d](https://github.com/gl-vis/snap-points-2d), which extends number of points up to `1e8` and speeds up construction up to ~30%.
* API covers the API of _gl-scatter2d-*_ components. Multipass rendering enables various colors, glyphs and sizes within single component.
* gl-plot2d compatible.
* fancy mode is enabled only for custom glyphs, regular scatter can render various colors/sizes/borders without memory overflow (up to 1e8 points)
-->

## Usage

[![npm install regl-scatter2d](https://nodei.co/npm/regl-scatter2d.png?mini=true)](https://npmjs.org/package/regl-scatter2d/)

```js
let scatter = require('regl-scatter2d')({
	positions: data,
	color: 'rgba(0, 100, 200, .75)'
})

scatter.draw()
```

## API

#### `let scatter = require('regl-scatter2d')(options)`

| Option | Default | Description |
|---|---|---|
| `regl` | `null` | Regl instance to reuse, or new regl is created. |
| `gl`, `canvas`, `container` | `null` | Options for `regl`, if new regl is created. |
| `plot` | `null` | [`gl-plot2d`](https://github.com/gl-vis/gl-plot2d) reference, if scatter is going to be used as a part of plot. |
| `pixelRatio` | `window.devicePixelRatio` | Display pixel density property. |
| `positions` | `[]` | A packed 2*n length array of the unrolled xy coordinates of the points (required) |
| `size` | `12` | number giving the diameter of a marker in pixels (default `12`) |
| `color` | `'red'` | color of a marker as a length 4 RGBA array (default `[1,0,0,1]`) |
| `borderSize` | `1` | width of the border around each point in pixels (default `1`) |
| `borderColor` | `'black'` | color of the border of each point (default `[0,0,0,1]`) |
| `glyph` | `null` | Glyph to use for marker, can be a single glyph or array. |
| `scale` | `[0, 0]` | Scale in terms of data units. |
| `translate` | `[0, 0]` | Translate in terms of data units. |
| `cluster` | `false` | defines whether points should be clustered to optimize rendering of huge number of points. (see [point-cluster](https://github.com/dfcreative/point-cluster)) |

**Returns** A new scatter plot object, which is also registered to `plot`

#### `scatter.update(options)`

Updates the scatter plot params with options above.

#### `scatter.draw()`

Draws data into canvas.

#### `scatter.dispose()`

Destroys the scatter plot and all associated resources.

## License

(c) 2017 Dima Yv. MIT License

Development supported by plot.ly
