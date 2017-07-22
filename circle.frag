precision mediump float;

varying vec4 fragColor, fragBorderColor;
varying float fragBorderRadius, fragWidth;

uniform float pixelRatio;

void main() {
	float radius, alpha = 1.0, delta = fragWidth;

	radius = length(2.0 * gl_PointCoord - 1.0);

	if(radius > 1.0 + delta) {
		discard;
	}

	alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, radius);

	vec4 baseColor = mix(fragColor, fragBorderColor, smoothstep(fragBorderRadius - delta, fragBorderRadius + delta, radius));
	baseColor.a *= alpha;
	gl_FragColor = baseColor;
}
