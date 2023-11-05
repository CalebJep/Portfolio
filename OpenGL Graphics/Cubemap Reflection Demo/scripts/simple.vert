#version 300 es

in vec4 aPosition;
in vec4 aNormal;
in vec2 vUV;

uniform mat4 mProjection;
uniform mat4 mView;
uniform mat4 mModel;

out vec4 worldPosition;
out vec4 fNormal;
out vec2 fUV;

void main()
{
    worldPosition = mModel * aPosition;
    gl_Position = mProjection * mView * worldPosition;

    mat4 mNormTransform = inverse(transpose(mModel));

    vec4 norm4 =  mNormTransform * aNormal;
    vec3 norm3 = normalize(vec3(-norm4.x, -norm4.y, -norm4.z));
    fNormal = vec4(norm3.x, norm3.y, norm3.z, 1);
    fUV = vUV;

}