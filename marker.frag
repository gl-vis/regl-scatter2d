precision mediump float;

// const float fragWeight = 1.0;

// varying vec4 fragColor, fragBorderColor;
// varying float centerFraction, fragBorderWidth, fragPointSize;

// uniform sampler2D marker;
// uniform float pixelRatio;

// float smoothStep(float x, float y) {
//   return 1.0 / (1.0 + exp(50.0*(x - y)));
// }

void main() {
  return;
  // float dist = texture2D(marker, gl_PointCoord).r;

  // //max-distance alpha
  // if (dist < 1e-2) discard;

  // // float gamma = .0045;
  // float gamma = .05;

  // //null-border case
  // if (fragBorderSize * fragBorderColor.a == 0.) {
  //   float charAmt = smoothstep(.748 - gamma, .748 + gamma, dist);
  //   gl_FragColor = vec4(fragColor.rgb, charAmt * fragColor.a);
  //   return;
  // }


  // float dif = 5. * pixelRatio * fragBorderSize / fragPointSize;
  // float borderLevel = .748 - dif * .5;
  // float charLevel = .748 + dif * .5;

  // float borderAmt = smoothstep(borderLevel - gamma, borderLevel + gamma, dist);
  // float charAmt = smoothstep(charLevel - gamma, charLevel + gamma, dist);

  // vec4 color = fragBorderColor;
  // color.a *= borderAmt;

  // gl_FragColor = mix(color, fragColor, charAmt);
}
