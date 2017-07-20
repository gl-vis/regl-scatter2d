precision mediump float;

const float fragWeight = 1.0;

varying vec4 fragColor, fragBorderColor;
varying float centerFraction, fragBorderSize, fragPointSize;

uniform sampler2D marker;
uniform float pixelRatio;

float smoothStep(float x, float y) {
  return 1.0 / (1.0 + exp(50.0*(x - y)));
}

void main() {
  float dist = texture2D(marker, gl_PointCoord).r;

  //max-distance alpha
  if (dist < 1e-2) discard;

  float gamma = .0045;

  //null-border case
  // if (fragBorderSize * fragBorderColor.a == 0.) {
  //   float charAmt = smoothstep(.748 - gamma, .748 + gamma, dist);
  //   gl_FragColor = vec4(fragColor.rgb, charAmt * fragColor.a);
  //   return;
  // }


  float dif = 5. * pixelRatio * fragBorderSize / fragPointSize;
  float borderLevel = .748 - dif * .5;
  float charLevel = .748 + dif * .5;

  float borderAmt = smoothstep(borderLevel - gamma, borderLevel + gamma, dist);
  float charAmt = smoothstep(charLevel - gamma, charLevel + gamma, dist);

  vec4 color = fragBorderColor;
  color.a *= borderAmt;

  gl_FragColor = mix(color, fragColor, charAmt);
  // gl_FragColor = vec4(vec3(charAmt), 1);


  // float radius = length(2.0*gl_PointCoord.xy-1.0);

  // if(radius > 1.0) {
  //   discard;
  // }

  // vec4 baseColor = mix(fragBorderColor, fragColor, smoothStep(radius, centerFraction));
  // float alpha = 1.0 - pow(1.0 - baseColor.a, fragWeight);
  // gl_FragColor = vec4(baseColor.rgb * alpha, alpha);

  // gl_FragColor = vec4(vec3(dist), 1);
}
