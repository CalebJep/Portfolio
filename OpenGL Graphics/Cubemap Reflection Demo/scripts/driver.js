MySample.main = (function() {
    'use strict';
    let ready = false;

    //animation timeframe data
    let current_interval = -1;
    let interval_time = 3000;
    let last_time = 0;

    let canvas = document.getElementById('canvas-main');
    let gl = canvas.getContext('webgl2');

    //transformation function used by all objects
    function generalTransform(t, r, s) {
        let t_s = [
            s[0], 0, 0, t[0],
            0, s[1], 0, t[1],
            0, 0, s[2], t[2],
            0, 0, 0, 1
        ];
        let cos = [Math.cos(r[0]), Math.cos(r[1]), Math.cos(r[2])];
        let sin = [Math.sin(r[0]), Math.sin(r[1]), Math.sin(r[2])];
        let rot = [
            cos[2]*cos[1], cos[2]*sin[1]*sin[0] - sin[2]*cos[0], cos[2]*sin[1]*cos[0] + sin[2]*sin[0], 0,
            sin[2]*cos[1], sin[2]*sin[1]*sin[0] + cos[2]*cos[0], sin[2]*sin[1]*cos[0] - cos[2]*sin[0], 0,
            -sin[1], cos[1]*sin[0], cos[1]*cos[0], 0,
            0, 0, 0, 1
        ];
        return multiplyMatrix4x4(t_s, rot);
    }
    
    //view and projection
    let orth_proj_matrix;
    let persp_proj_matrix;
    {
        let right = 1;
        let left = -right;
        let top = 1;
        let bottom = -top;
        let near = 1;
        let far = 20;
        orth_proj_matrix = transposeMatrix4x4([
            2 / (right - left), 0, 0, -(left + right) / (right - left),
            0, 2 / (top - bottom), 0, -(top + bottom) / (top - bottom),
            0, 0, -2 / (far - near), -(far + near) / (far - near),
            0, 0, 0, 1
        ]);
        persp_proj_matrix = transposeMatrix4x4([
            2*near / (right - left), 0, (right + left) / (right - left), 0,
            0, 2*near / (top - bottom), (top + bottom) / (top - bottom), 0,
            0, 0, -(far + near) / (far - near), -2*far*near / (far - near),
            0, 0, -1, 0
        ]);
    }
    let view_matrix = transposeMatrix4x4([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, -4,
        0, 0, 0, 1
    ]);

    //3d models
    let bunny;
    readPlyAsObject("models/bunny.ply").then(res => {
        bunny = res;
        bunny.t = [0, -3, -4];
        bunny.r = [0, 0, 0];
        bunny.s = [4, 4, 4];
        bunny.transform = function() {
            return transposeMatrix4x4(generalTransform(this.t, this.r, this.s));
        };
        return readPlyAsObject("models/cube.ply");
    }).then(res => {
        res.t = world.skycube.t;
        res.r = world.skycube.r;
        res.s = world.skycube.s;
        res.transform = function() {
            return transposeMatrix4x4(generalTransform(this.t, this.r, this.s));
        };
        world.skycube = res;
        return loadTextureFromServer("models/bunny.png");
    }).then(res => {
        plastic1.albTexture = res;
        current_shape = bunny;
        
        //load the environment texture
        return loadTextureFromServer("skyboxes/crimson-tide_bk.jpg");
    }).then(img => {
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, world.skybox);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        return loadTextureFromServer("skyboxes/crimson-tide_dn.jpg");
    }).then(img => {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        return loadTextureFromServer("skyboxes/crimson-tide_ft.jpg");
    }).then(img => {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        return loadTextureFromServer("skyboxes/crimson-tide_lf.jpg");
    }).then(img => {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        return loadTextureFromServer("skyboxes/crimson-tide_rt.jpg");
    }).then(img => {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        return loadTextureFromServer("skyboxes/crimson-tide_up.jpg");
    }).then(img => {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        makeBuffers(bunny);
        setUp();

    });

    //materials
    let plastic1 = {
        albedo: [0.4117, 0.3281, 0.5],
        specular: [0.50, 0.50, 0.50],
        matMetallic: 0.0,
        albTexture: null,
        n: 4
    };

    //world
    let world = {
        ambient: [0.05, 0.05, 0.15],
        skybox: gl.createTexture(),
        skycube: {
            // vertices: new Float32Array([
            //     1, 1, 1,    //TRF
            //     1, 1, -1,   //TRB
            //     1, -1, 1,   //BRF
            //     1, -1, -1,  //BRB
            //     -1, 1, 1,   //TLF
            //     -1, 1, -1,  //TLB
            //     -1, -1, 1,  //BLF
            //     -1, -1, -1, //BLB
            // ]),
            // indices: new Uint32Array([
            //     0, 4, 2,
            //     4, 6, 2,
            //     1, 0, 3,
            //     0, 2, 3,
            //     1, 7, 5,
            //     1, 3, 7,
            //     4, 7, 6,
            //     4, 5, 7,
            //     2, 7, 3,
            //     2, 6, 7,
            //     0, 1, 5,
            //     0, 5, 4,
            // ]),

            t: [0, -3, -4],
            r: [0, 0, 0],
            s: [10, 10, -10],
            transform: function() {
                return transposeMatrix4x4(generalTransform(this.t, this.r, this.s));
            }
        },
        lPosition: [
            2.0, 0.0, -3.0,
            0.0, 0.0, 0.0
        ],
        lColor: [
            0.0, 2.50, 2.50,
            2.0, 1.0, 0.0
        ],
        addLight: function(position, color) {
            this.lPosition = this.lPosition.concat(position);
            this.lColor = this.lColor.concat(color);
        },
        removeLight: function(index) {
            this.lPosition.splice(index * 3, 3);
            this.lColor.splice(index * 3, 3);
        }
    }

    //global variables related to rendering
    let current_shape;
    let current_material = plastic1;
    let current_projection = persp_proj_matrix;

    let vertexBuffer = gl.createBuffer();
    let vertexNormalBuffer = gl.createBuffer();
    let uvBuffer = gl.createBuffer();
    let indexBuffer = gl.createBuffer();

    let skyVertBuffer = gl.createBuffer();
    let skyIndexBuffer = gl.createBuffer();

    let vertShaderSource;
    let vertShader = gl.createShader(gl.VERTEX_SHADER);
    let fragmentShaderSource;
    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    let worldVertShaderSource;
    let worldVertShader = gl.createShader(gl.VERTEX_SHADER);
    let worldFragmentShaderSource;
    let worldFragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    let shaderProgram = gl.createProgram();
    let worldShaderProgram = gl.createProgram();

    let textureBuffer = gl.createTexture();
   


    //function to make the buffers
    function makeBuffers(shape) {
        gl.linkProgram(shaderProgram);
        gl.useProgram(shaderProgram);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, shape.vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, shape.vertexNormals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, shape.uvs, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, shape.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, current_material.albTexture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    }

    function makeSkyBuffers() {
        gl.linkProgram(worldShaderProgram);
        gl.useProgram(worldShaderProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, skyVertBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, world.skycube.vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, world.skycube.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        // gl.bindTexture(gl.TEXTURE_CUBE_MAP, world.skybox);
    }

    function bindSkyBuffers() {
        gl.linkProgram(worldShaderProgram);
        gl.useProgram(worldShaderProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, skyVertBuffer);
        let positionSky = gl.getAttribLocation(worldShaderProgram, 'aPosition');
        gl.enableVertexAttribArray(positionSky);
        gl.vertexAttribPointer(positionSky, 3, gl.FLOAT, false, world.skycube.vertices.BYTES_PER_ELEMENT * 3, 0);

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, world.skybox);
        let samplerLocation0 = gl.getUniformLocation(worldShaderProgram, 'skySampler2');
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, world.skybox);
        gl.uniform1i(samplerLocation0, 2);

        let location0 = gl.getUniformLocation(worldShaderProgram, 'mProjection');
        gl.uniformMatrix4fv(location0, false, current_projection);
        location0 = gl.getUniformLocation(worldShaderProgram, 'mView');
        gl.uniformMatrix4fv(location0, false, view_matrix);
        location0 = gl.getUniformLocation(worldShaderProgram, 'mModel');
        gl.uniformMatrix4fv(location0, false, world.skycube.transform());
    }

    //function to bind the buffers
    function bindAllBuffers(shape) {

        gl.linkProgram(shaderProgram);
        gl.useProgram(shaderProgram)

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        let position = gl.getAttribLocation(shaderProgram, 'aPosition');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, shape.vertices.BYTES_PER_ELEMENT * 3, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
        let normal = gl.getAttribLocation(shaderProgram, 'aNormal');
        gl.enableVertexAttribArray(normal);
        gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, shape.vertexNormals.BYTES_PER_ELEMENT * 3, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        let uv = gl.getAttribLocation(shaderProgram, 'vUV');
        gl.enableVertexAttribArray(uv);
        gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, shape.uvs.BYTES_PER_ELEMENT * 2, 0);

        gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
        let samplerLocation = gl.getUniformLocation(shaderProgram, 'uSampler');
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
        gl.uniform1i(samplerLocation, 0);

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, world.skybox);
        let samplerLocation2 = gl.getUniformLocation(shaderProgram, 'skySampler');
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, world.skybox);
        gl.uniform1i(samplerLocation2, 1);

        //set up transformation uniforms
        let location = gl.getUniformLocation(shaderProgram, 'mProjection');
        gl.uniformMatrix4fv(location, false, current_projection);
        location = gl.getUniformLocation(shaderProgram, 'mView');
        gl.uniformMatrix4fv(location, false, view_matrix);
        location = gl.getUniformLocation(shaderProgram, 'mModel');
        gl.uniformMatrix4fv(location, false, current_shape.transform());

        location = gl.getUniformLocation(shaderProgram, 'camPosition');
        gl.uniform3fv(location, [view_matrix[3], view_matrix[7], view_matrix[11]]);

        //not sure if this goes here
        gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, current_material.albTexture);
        //

        setUpMaterial();
    }


    //general set up - calls makeBuffers and bindAllBuffers
    function setUp() { 
        makeBuffers(current_shape);
        loadFileFromServer("scripts/simple.vert").then(text => {
            console.log(text);
            vertShaderSource = text;
            gl.shaderSource(vertShader, vertShaderSource);
            gl.compileShader(vertShader);
            return loadFileFromServer("scripts/simple.frag");
        }).then(text => {
            console.log(text)
            fragmentShaderSource = text;
            gl.shaderSource(fragmentShader, fragmentShaderSource);
            gl.compileShader(fragmentShader);
            return loadFileFromServer("scripts/world.vert");
        }).then(text => {
            worldVertShaderSource = text;
            gl.shaderSource(worldVertShader, worldVertShaderSource);
            gl.compileShader(worldVertShader);
            return loadFileFromServer("scripts/world.frag");
        }).then(text => {
            worldFragmentShaderSource = text;
            gl.shaderSource(worldFragmentShader, worldFragmentShaderSource);
            gl.compileShader(worldFragmentShader);


            gl.attachShader(worldShaderProgram, worldVertShader);
            gl.attachShader(worldShaderProgram, worldFragmentShader);
            

            gl.attachShader(shaderProgram, vertShader);
            gl.attachShader(shaderProgram, fragmentShader);
    
           bindAllBuffers(current_shape);

           gl.clearColor(
                0.3921568627450980392156862745098,
                0.58431372549019607843137254901961,
                0.92941176470588235294117647058824,
                1.0);
            gl.clearDepth(1.0);
            gl.depthFunc(gl.LEQUAL);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);

            //set up lighting information
            setUpLighting();

            ready = true;
        });
    }
    //------------------------------------------------------------------
    //
    // Scene updates go here.
    //
    //------------------------------------------------------------------
    function update() {
        if (!ready) {
            return;
        }

        //update the shape's transform
        current_shape.r[1] += .02;
        // world.skycube.r[1] += .02;
        current_material.matMetallic = (current_material.matMetallic + .002) % 1;

        gl.linkProgram(shaderProgram);
        gl.useProgram(shaderProgram);
        setUpMaterial();
        let location = gl.getUniformLocation(shaderProgram, 'mModel');
        gl.uniformMatrix4fv(location, false, current_shape.transform());

        // gl.linkProgram(worldShaderProgram);
        // gl.useProgram(worldShaderProgram);
        // location = gl.getUniformLocation(worldShaderProgram, 'mModel');
        // gl.uniformMatrix4fv(location, false, world.skycube.transform());
    }
    //------------------------------------------------------------------
    //
    // Rendering code goes here
    //
    //------------------------------------------------------------------
    function render() {
        if (!ready) {
            return;
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.linkProgram(shaderProgram);
        gl.useProgram(shaderProgram);
        makeBuffers(current_shape);
        bindAllBuffers(current_shape);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, current_shape.indices.length, gl.UNSIGNED_INT, 0);

        gl.linkProgram(worldShaderProgram);
        gl.useProgram(worldShaderProgram);
        makeSkyBuffers();
        bindSkyBuffers();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIndexBuffer);
        gl.drawElements(gl.TRIANGLES, world.skycube.indices.length, gl.UNSIGNED_INT, 0);


        
    }
    //------------------------------------------------------------------
    //
    // This is the animation loop.
    //
    //------------------------------------------------------------------
    function animationLoop(time) {

        update();
        render();

        requestAnimationFrame(animationLoop);
    }


    function setUpMaterial() {
        let location = gl.getUniformLocation(shaderProgram, 'matAmbient');
        gl.uniform3fv(location, current_material.albedo);
        location = gl.getUniformLocation(shaderProgram, 'matDiffuse');
        gl.uniform3fv(location, current_material.albedo);
        location = gl.getUniformLocation(shaderProgram, 'matSpecular');
        gl.uniform3fv(location, current_material.specular);
        location = gl.getUniformLocation(shaderProgram, 'matMetallic');
        gl.uniform1f(location, current_material.matMetallic);
        location = gl.getUniformLocation(shaderProgram, 'matN');
        gl.uniform1f(location, current_material.n);
    }

    function setUpLighting() {
        gl.useProgram(shaderProgram);

        let location = gl.getUniformLocation(shaderProgram, 'ambientLight');
        gl.uniform3fv(location, world.ambient);

        location = gl.getUniformLocation(shaderProgram, 'lPosition');
        gl.uniform3fv(location, world.lPosition);

        location = gl.getUniformLocation(shaderProgram, 'lColor');
        gl.uniform3fv(location, world.lColor);

        location = gl.getUniformLocation(shaderProgram, 'lightCount');
        gl.uniform1i(location, world.lColor.length / 3);

    }

    //function to change the current projection
    function changeProjection(projection) {
        current_projection = projection;
        let location = gl.getUniformLocation(shaderProgram, 'mProjection');
        gl.uniformMatrix4fv(location, false, current_projection);
    }

    console.log('initializing...');
    requestAnimationFrame(animationLoop);

}());
