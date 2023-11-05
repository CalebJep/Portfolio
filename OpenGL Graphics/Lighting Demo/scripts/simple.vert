#version 300 es
in vec4 aPosition;
in vec4 aNormal;

uniform mat4 mProjection;
uniform mat4 mView;
uniform mat4 mModel;

uniform vec3 matAmbient;
uniform vec3 matDiffuse;
uniform vec3 matSpecular;
uniform int matN;

uniform vec3 ambientLight;
uniform int lightCount;
uniform vec3 lPosition[32];
uniform vec3 lColor[32];

out vec4 vColor;

void main()
{
    vec4 worldPosition =  mModel * aPosition;
    gl_Position = mProjection * mView * worldPosition;

    mat4 mNormTransform = inverse(transpose(mModel));

    vec4 norm4 =  mNormTransform * aNormal;
    vec3 norm3 = normalize(vec3(-norm4.x, -norm4.y, -norm4.z));
    vColor = vec4(
        matAmbient.r * ambientLight.r,
        matAmbient.g * ambientLight.g,
        matAmbient.b * ambientLight.b,
        1
    );
    
    for(int i = 0; i < lightCount; i++)
    {
        
        vec3 toLight = lPosition[i] - vec3(worldPosition.x, worldPosition.y, worldPosition.z);
        
        float intens = dot(norm3, normalize(toLight));
        if(intens > 0.0) 
            vColor += vec4(
                intens * matDiffuse.r * lColor[i].r,
                intens * matDiffuse.g * lColor[i].g,
                intens * matDiffuse.b * lColor[i].b,
                0
            );

    }
    vColor.r = min(vColor.r, 1.0);
    vColor.g = min(vColor.g, 1.0);
    vColor.b = min(vColor.b, 1.0);
}