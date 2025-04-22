varying vec4 vertex_color;
varying float zcoordi;

void main() {
    // Previous version that ignored color
    //float z = 0.2 + ( 1000. - zcoordi ) / 1000. * vertex_color.x;
    //gl_FragColor = vec4( z, z, z, 1. );

    // Calculate depth-based brightness factor (0.2 to 1.0 range)
    float brightness = 0.2 + (1000.0 - zcoordi) / 1000.0;
    
    // Apply brightness to each color channel independently
    vec3 finalColor = vertex_color.rgb * brightness;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
