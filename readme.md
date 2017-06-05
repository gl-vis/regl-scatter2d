# regl-scatter2d

Scatter plot for lots of points.

Remake on [gl-scatter2d](https://github.com/gl-vis/gl-scatter2d), [gl-scatter2d-fancy](https://github.com/gl-vis/gl-scatter2d-fancy) and [gl-scatter2d-sdf](https://github.com/gl-vis/gl-scatter2d-sdf). Main improvements:

* [point-cluster](https://github.com/dfcreative/point-cluster) is used instead of [snap-points-2d](https://github.com/gl-vis/snap-points-2d), which extends number of points up to `1e8` and speeds up construction up to ~30%.
* API covers the API of _gl-scatter2d-*_ components. Multipass rendering enables various colors, glyphs and sizes within single component.
* gl-plot2d compatible.

## Usage

```js
let regl = require('regl')()
let scatter = require('regl-scatter2d')({regl})
```

## API

### `let scatter = require('regl-scatter2d')(options)`

| Option | Default | Description |
|---|---|---|
| `regl` | `null` | Regl instance to reuse, or new regl is created. |
| `gl`, `canvas`, `container` | `null` | Options for `regl`, if new regl is created. |
| `pixelRatio` | `window.devicePixelRatio` | Display pixel density property. |
| `positions` | A packed 2*n length array of the unrolled xy coordinates of the points (required) |
| `size` | number giving the diameter of a marker in pixels (default `12`) |
| `color` | color of a marker as a length 4 RGBA array (default `[1,0,0,1]`) |
| `borderSize` | width of the border around each point in pixels (default `1`) |
| `borderColor` | color of the border of each point (default `[0,0,0,1]`) |
| `glyph` | `null` | Glyph to use for marker, can be a single glyph or array. |
| `scale` | `[0, 0]` | Scale in terms of data units. |
| `translate` | `[0, 0]` | Translate in terms of data units. |
| `cluster` | defines whether points should be clustered to optimize rendering of huge number of points. (see [point-cluster](https://github.com/dfcreative/point-cluster)) |

**Returns** A new scatter plot object, which is also registered to `plot`

### `scatter.update(options)`

Updates the scatter plot params with options above.

### `scatter.dispose()`

Destroys the scatter plot and all associated resources.

## License
(c) 2015 Mikola Lysenko. MIT License

Development supported by plot.ly
