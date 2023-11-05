#version 300 es

precision lowp float;

in vec3 cubeUVpos;

uniform samplerCube skySampler2;

out vec4 outColor;

void main() {
    outColor = texture(skySampler2, cubeUVpos);
    // outColor = vec4(1.0, 1.0, 0.0, 1.0);

}