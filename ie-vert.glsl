precision highp float;

attribute vec2 position, positionFract;
attribute float size, borderSize;

uniform vec2 scale, scaleFract, translate, translateFract;
uniform float pixelRatio;

const float maxSize = 100.;

varying vec4 fragColor, fragBorderColor;
varying float fragBorderRadius, fragWidth, fragBorderSize, fragSize;

void main() {
  float size = size * maxSize / 255.;
  float borderSize = borderSize * maxSize / 255.;
  fragBorderSize = borderSize;
  fragSize = size;

  gl_PointSize = (size + borderSize) * pixelRatio;

  vec2 pos = (position + translate) * scale
			+ (positionFract + translateFract) * scale
			+ (position + translate) * scaleFract
			+ (positionFract + translateFract) * scaleFract;

  gl_Position = vec4(pos * 2. - 1., 0, 1);

  fragBorderRadius = borderSize == 0. ? 2. : 1. - 2. * borderSize / (size + borderSize);
  fragWidth = 1. / gl_PointSize;
}
