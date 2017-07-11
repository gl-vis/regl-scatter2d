# regl-scatter2d [![experimental](https://img.shields.io/badge/stability-unstable-green.svg)](http://github.com/badges/stability-badges)

Scatter plot for lots of points.

Remake on [gl-scatter2d](https://github.com/gl-vis/gl-scatter2d), covering other scatter-related components.

## Usage

[![npm install regl-scatter2d](https://nodei.co/npm/regl-scatter2d.png?mini=true)](https://npmjs.org/package/regl-scatter2d/)

```js
let scatter = require('regl-scatter2d')({
	positions: data,
	color: 'rgba(0, 100, 200, .75)'
})

scatter()
```

## API

#### `drawScatter = require('regl-scatter2d')(options)`

| Property | Default | Description |
|---|---|---|
| `regl` | `null` | Regl instance to reuse, otherwise new regl is created. |
| `gl`, `canvas`, `container` | `null` | Options for `regl`, if new regl is created. |

The rest of options is passed into `drawScatter` method.

#### `drawScatter(positions|options?)`

Redraw scatter. Takes over new options.

| Property | Default | Description |
|---|---|---|
| `positions` | `[]` | A packed 2*n length array of the unrolled xy coordinates of the points. |
| `size` | `12` | Number or array with marker sizes in pixels. Array length should correspond to `positions`. |
| `color` | `'red'` | Color or array with marker colors. Each color can be a css-color string or an array with float `0..1` values. |
| `border` | `'1px black'` | Border css-declaration, can be set up separately as `borderSize` and `borderColor`. |
| `glyph` | `null` | Glyph or array with glyphs to use for markers. |
| `range` | `null` | Data bounds limiting visible data. If `null`, the range is detected from the positions. |

## License

(c) 2017 Dima Yv. MIT License

Development supported by plot.ly.
