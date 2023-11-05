#version 300 es

precision lowp float;

in vec4 fNormal;
in vec4 worldPosition;
in vec2 fUV;

uniform vec3 camPosition;

uniform vec3 matAmbient;
uniform vec3 matDiffuse;
uniform vec3 matSpecular;
uniform float matN;
uniform float matMetallic;

uniform sampler2D uSampler;
uniform samplerCube skySampler;

uniform vec3 ambientLight;
uniform int lightCount;
uniform vec3 lPosition[32];
uniform vec3 lColor[32];

out vec4 outColor;

void main()
{
    vec4 texColor = texture(uSampler, fUV);

    
    outColor = vec4(
        matAmbient.r * ambientLight.r,
        matAmbient.g * ambientLight.g,
        matAmbient.b * ambientLight.b,
        1
    );

    vec4 specColor = vec4(0, 0, 0, 1);
    vec3 vVec = normalize(vec3(
            camPosition.x - worldPosition.x,
            camPosition.y - worldPosition.y,
            camPosition.z - worldPosition.z
        ));
    
    for(int i = 0; i < lightCount; i++)
    {
        
        vec3 toLight = lPosition[i] - vec3(worldPosition.x, worldPosition.y, worldPosition.z);
        toLight = normalize(toLight);
        vec3 norm3 = vec3(fNormal.x, fNormal.y, fNormal.z);
        float intens = dot(norm3, toLight);
        if(intens > 0.0) 
        {
            outColor += vec4(
                intens * matDiffuse.r * lColor[i].r,
                intens * matDiffuse.g * lColor[i].g,
                intens * matDiffuse.b * lColor[i].b,
                0
            );
        }

        vec3 rVec = reflect(toLight, norm3);
        
        intens = dot(vVec, rVec);
        if(intens > 0.0)
        {
            intens = pow(intens, matN);
            specColor += vec4(
                intens * matSpecular.r * lColor[i].r,
                intens * matSpecular.g * lColor[i].g,
                intens * matSpecular.b * lColor[i].b,
                0
            );
        }



    }
    

    vec3 rVec2 = normalize(reflect(vVec, fNormal.xyz));
    outColor = (matMetallic * texture(skySampler, rVec2) + (1.0 - matMetallic) * (outColor + specColor) * texColor);

    outColor.r = min(outColor.r, 1.0);
    outColor.g = min(outColor.g, 1.0);
    outColor.b = min(outColor.b, 1.0);
    
}