precision mediump float;

attribute vec2 position, positionFract;
attribute float size, borderSize;
attribute float colorId, borderColorId;

uniform vec2 scale, scaleFract, translate, translateFract, paletteSize;
uniform float pixelRatio;
uniform sampler2D palette;

const float maxSize = 100.;
const float borderLevel = .5;

varying vec4 fragColor, fragBorderColor;
varying float fragPointSize, fragBorderRadius,
		fragWidth, fragBorderColorLevel, fragColorLevel;

vec2 paletteCoord(float id) {
  return vec2(
    (mod(id, paletteSize.x) + .5) / paletteSize.x,
    (floor(id / paletteSize.x) + .5) / paletteSize.y
  );
}

void main() {
  vec4 color = texture2D(palette, paletteCoord(colorId));
  vec4 borderColor = texture2D(palette, paletteCoord(borderColorId));

  float size = size * maxSize / 255.;
  float borderSize = borderSize * maxSize / 255.;

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
