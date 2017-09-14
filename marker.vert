precision mediump float;

attribute vec2 position, positionFract;
attribute float size;
attribute float borderSize;
attribute float colorIdx;
attribute float borderColorIdx;

uniform vec2 scale, scaleFract, translate, translateFract;
uniform float paletteSize, pixelRatio;
uniform sampler2D palette;

const float borderLevel = .5;

varying vec4 fragColor, fragBorderColor;
varying float fragPointSize, fragBorderRadius,
		fragWidth, fragBorderColorLevel, fragColorLevel;

void main() {
  vec4 color = texture2D(palette, vec2((colorIdx + .5) / paletteSize, 0));
  vec4 borderColor = texture2D(palette, vec2((borderColorIdx + .5) / paletteSize, 0));

  gl_PointSize = 2. * size * pixelRatio;
  fragPointSize = size * pixelRatio;

  vec2 pos = (position + translate) * scale
      + (positionFract + translateFract) * scale
      + (position + translate) * scaleFract
      + (positionFract + translateFract) * scaleFract;

  gl_Position = vec4(pos * 2. - 1., 0, 1);

  fragColor = color;
  fragBorderColor = borderColor;
  fragWidth = 1. / gl_PointSize;

  fragBorderColorLevel = clamp(borderLevel - borderLevel * borderSize / size, 0., 1.);
  fragColorLevel = clamp(borderLevel + (1. - borderLevel) * borderSize / size, 0., 1.);
}
