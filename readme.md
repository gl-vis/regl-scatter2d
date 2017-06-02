# regl-scatter2d

Scatter plot for lots of points.

Remake on [gl-scatter2d](), [gl-scatter2d-fancy]() and [gl-scatter2d-sdf](), covering API of all three.

## Usage

```js
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
| `cluster` | defines whether points should be clustered to optimize rendering of huge number of points. (see [point-cluster](https://github.com/dfcreative/point-cluster)) |

**Returns** A new scatter plot object, which is also registered to `plot`

### `scatter.update(options)`

Updates the scatter plot params with options above.

### `scatter.dispose()`

Destroys the scatter plot and all associated resources.

## License
(c) 2015 Mikola Lysenko. MIT License

Development supported by plot.ly
