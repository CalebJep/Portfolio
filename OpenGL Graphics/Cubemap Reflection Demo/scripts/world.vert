#version 300 es

in vec4 aPosition;

uniform mat4 mProjection;
uniform mat4 mView;
uniform mat4 mModel;

out vec3 cubeUVpos;

void main()
{
    gl_Position = mProjection * mView * mModel * aPosition;
    cubeUVpos = vec3(aPosition);
    // gl_Position = aPosition;

}