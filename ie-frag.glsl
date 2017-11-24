precision mediump float;

uniform vec4 color, borderColor;
uniform float opacity;
varying float fragBorderRadius, fragWidth, fragBorderSize, fragSize;

float smoothStep(float x, float y) {
  return 1.0 / (1.0 + exp(50.0*(x - y)));
}

void main() {
  float radius = length(2.0*gl_PointCoord.xy-1.0);
  if(radius > 1.0) {
    discard;
  }

  float centerFraction = fragBorderSize == 0. ? 2. : fragSize / (fragSize + fragBorderSize + 1.25);

  vec4 baseColor = mix(borderColor, color, smoothStep(radius, centerFraction));
  float alpha = 1.0 - pow(1.0 - baseColor.a, 1.);
  gl_FragColor = vec4(baseColor.rgb * alpha, alpha);
}
