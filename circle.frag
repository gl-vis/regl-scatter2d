precision mediump float;

const float fragWeight = 1.0;

varying vec4 fragColor, fragBorderColor;
varying float centerFraction, fragBorderSize, fragPointSize;

uniform float pixelRatio;

float smoothStep(float x, float y) {
  return 1.0 / (1.0 + exp(50.0*(x - y)));
}

void main() {
  float radius = length(2.0 * gl_PointCoord.xy-1.0);

  if(radius > 1.0) {
    discard;
  }

  vec4 baseColor = mix(fragBorderColor, fragColor, smoothStep(radius, centerFraction));
  float alpha = 1.0 - pow(1.0 - baseColor.a, fragWeight);
  gl_FragColor = vec4(baseColor.rgb * alpha, alpha);
}
