precision highp float;

attribute vec2 position;
attribute float size;
attribute float borderSize;
attribute float colorIdx;
attribute float borderColorIdx;

uniform vec2 scale, translate;
uniform float paletteSize, pixelRatio;
uniform sampler2D palette;

varying vec4 fragColor, fragBorderColor;
varying float fragBorderRadius, fragWidth;

void main() {
  vec4 color = texture2D(palette, vec2((colorIdx + .5) / paletteSize, 0));
  vec4 borderColor = texture2D(palette, vec2((borderColorIdx + .5) / paletteSize, 0));

  gl_PointSize = (size + borderSize) * pixelRatio;
  gl_Position = vec4((position * scale + translate) * 2. - 1., 0, 1);

  fragBorderRadius = borderSize == 0. ? 2. : 1. - 2. * borderSize / (size + borderSize);
  fragColor = color;
  fragBorderColor = borderColor;
  fragWidth = 1. / gl_PointSize;
}
