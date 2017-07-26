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

Property | Default | Description
---|---|---
`regl` | `null` | Regl instance to reuse, otherwise new regl is created.
`gl`, `canvas`, `container` | `null` | Options for `regl`, if new regl is created.

The rest of options is forwarded into `drawScatter`.

#### `drawScatter(points|options?)`

Redraw points. Takes over new options.

Property | Default | Description
---|---|---
`positions`, `points` | `[]` | An array of the unrolled xy coordinates of the points as `[x,y, x,y, ...]` or array of points `[[x,y], [x,y], ...]`.
`size` | `12` | Number or array with marker sizes in pixels. Array length should correspond to `positions`.
`borderSize` | `1` | Number or array with border sizes in pixels. Array length should correspond to `positions`.
`color`, `colors` | `'red'` | Color or array with colors. Each color can be a css-color string or an array with float `0..1` values. If `palette` is defined, `color` can be a number pointing at the color in the palette.
`borderColor`, `borderColors` | `'black'` | Border color or array with border colors. If `palette` is defined, `borderColor` can be a number pointing at the color in the palette.
`palette` | `null` | List of colors, eg. `['red', 'green', 'blue', 'black']`.
`marker`, `markers` | `null` | Marker sdf image, should be a rectangular array with `0..1` 1-channel values of signed distance field. Use [bitmap-sdf](https://github.com/dfcreative/bitmap-sdf) to generate sdf from any image. `.5` value of distance corresponds to the border line. If `null`, circular marker is used.
`range` | `null` | Data bounds limiting visible data as `[left, top, right, bottom]`. If `null`, the range is detected as `positions` boundaries.
`ids` | `null` | List of point ids to draw, corresponding to `points`. If undefined, all available points will be drawn.
`precision` | `'low'` | Positions precision, `'high'` or `'low'`. Tradeoff between max number of points and rendering performance.

## License

(c) 2017 Dima Yv. MIT License

Development supported by plot.ly.
