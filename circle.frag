#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

precision mediump float;

varying vec4 fragColor, fragBorderColor;
varying float fragBorderRadius;

uniform float pixelRatio;

void main() {
	float radius, alpha = 1.0, delta = 0.0;

	radius = length(2.0 * gl_PointCoord - 1.0);

	if(radius > 1.0) {
		discard;
	}

	//antialias outline
	#ifdef GL_OES_standard_derivatives
		delta = fwidth(radius);
		alpha = 1.0 - smoothstep(1.0 - delta, 1.0, radius);
	#endif

	vec4 baseColor = mix(fragColor, fragBorderColor, smoothstep(fragBorderRadius - delta, fragBorderRadius, radius));
	baseColor.a *= alpha;
	gl_FragColor = baseColor;
}
