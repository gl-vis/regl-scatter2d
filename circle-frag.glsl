precision highp float;

varying vec4 fragColor, fragBorderColor;
varying float fragBorderRadius, fragWidth;

uniform float pixelRatio, opacity;

void main() {
	float radius, alpha = 1.0, delta = fragWidth;

	radius = length(2.0 * gl_PointCoord - 1.0);

	if(radius > 1.0 + delta) {
		discard;
		return;
	}

	alpha -= smoothstep(1.0 - delta, 1.0 + delta, radius);

	vec4 color = mix(fragColor, fragBorderColor, smoothstep(fragBorderRadius - delta, fragBorderRadius + delta, radius));
	color.a *= alpha * opacity;
	gl_FragColor = color;
}
