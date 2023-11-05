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
        let right = 2;
        let left = -right;
        let top = 2;
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
        0, 1, 0, -1.5,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);

    //3d models
    let bunny;
    readPlyAsObject("models/bun_zipper_res4.ply").then(res => {
        bunny = res;
        bunny.t = [0, -3, -4];
        bunny.r = [0, 0, 0];
        bunny.s = [2, 2, 2];
        bunny.transform = function() {
            return transposeMatrix4x4(generalTransform(this.t, this.r, this.s));
        };
        current_shape = bunny;
        makeBuffers(bunny);
        setUp();
    });
    let dragon;
    readPlyAsObject("models/dragon_vrip_res2.ply").then(res => {
        dragon = res;
        dragon.t = [0, -3, -4];
        dragon.r = [0, 0, 0];
        dragon.s = [2, 2, 2];
        dragon.transform = function() {
            return transposeMatrix4x4(generalTransform(this.t, this.r, this.s));
        };
    });

    //materials
    let plastic1 = {
        albedo: [0.4117, 0.3281, 0.5],
        specular: [1.0, 1.0, 0.95],
        n: 2
    };

    //world
    let world = {
        ambient: [0.01, 0.01, 0.15],
        lPosition: [
            2.0, 0.0, -3.0,
        ],
        lColor: [
            1.0, 0.0, 0.0,
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
    let indexBuffer = gl.createBuffer();
    let vertShaderSource;
    let vertShader = gl.createShader(gl.VERTEX_SHADER);
    let fragmentShaderSource;
    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    let shaderProgram = gl.createProgram();


    //function to make the buffers
    function makeBuffers(shape) {
        
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, shape.vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
        
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, shape.vertexNormals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, shape.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    //function to bind the buffers
    function bindAllBuffers(shape) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        let position = gl.getAttribLocation(shaderProgram, 'aPosition');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, shape.vertices.BYTES_PER_ELEMENT * 3, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
        let normal = gl.getAttribLocation(shaderProgram, 'aNormal');
        gl.enableVertexAttribArray(normal);
        gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, shape.vertexNormals.BYTES_PER_ELEMENT * 3, 0);

        setUpMaterial();
    }

    //general set up - calls makeBuffers and bindAllBuffers
    function setUp() { 
        makeBuffers(current_shape);
        loadFileFromServer("scripts/simple.vert").then(text => {
            console.log(text);
            vertShaderSource = text;
        }).then(res => {
            gl.shaderSource(vertShader, vertShaderSource);
            gl.compileShader(vertShader);
        }).then(res => {
            return loadFileFromServer("scripts/simple.frag");
        }).then(text => {
            console.log(text)
            fragmentShaderSource = text;
        }).then(res => {
            gl.shaderSource(fragmentShader, fragmentShaderSource);
            gl.compileShader(fragmentShader);
        }).then(res => {
            gl.attachShader(shaderProgram, vertShader);
            gl.attachShader(shaderProgram, fragmentShader);
            gl.linkProgram(shaderProgram);
    
            gl.useProgram(shaderProgram);
    
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
    
            //set up transformation uniforms
            let location = gl.getUniformLocation(shaderProgram, 'mProjection');
            gl.uniformMatrix4fv(location, false, current_projection);
            location = gl.getUniformLocation(shaderProgram, 'mView');
            gl.uniformMatrix4fv(location, false, view_matrix);
            location = gl.getUniformLocation(shaderProgram, 'mModel');
            gl.uniformMatrix4fv(location, false, current_shape.transform());

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
        let location = gl.getUniformLocation(shaderProgram, 'mModel');
        gl.uniformMatrix4fv(location, false, current_shape.transform());
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

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, current_shape.indices.length, gl.UNSIGNED_INT, 0);
    }
    //------------------------------------------------------------------
    //
    // This is the animation loop.
    //
    //------------------------------------------------------------------
    function animationLoop(time) {
        if (time - last_time > interval_time) {
            current_interval = (current_interval + 1) % 6;
            last_time = time;
            switch (current_interval) {
                case 0:
                    world.addLight([-3.0, 1.0, -3.0], [0.0, 0.0, 1.0]);
                    setUpLighting();
                    setUpMaterial();
                    break;
                case 1:
                    world.addLight([0.0, 3.0, -2.0], [0.0, 2.0, 0.0]);
                    setUpLighting();
                    setUpMaterial();
                    break;
                case 2:
                    changeShape(dragon);
                    break;
                case 3:
                    world.removeLight(0);
                    setUpLighting();
                    setUpMaterial();
                    break;
                case 4:
                    world.removeLight(0);
                    setUpLighting();
                    setUpMaterial();
                    break;
                case 5:
                    changeShape(bunny);
                    break;
            }
        }

        update();
        render();

        requestAnimationFrame(animationLoop);
    }

    //function to change the current rendering shape
    function changeShape(shape) {
        current_shape = shape
        makeBuffers(current_shape);
        bindAllBuffers(current_shape);
    }

    function setUpMaterial() {
        let location = gl.getUniformLocation(shaderProgram, 'matAmbient');
        gl.uniform3fv(location, current_material.albedo);
        location = gl.getUniformLocation(shaderProgram, 'matDiffuse');
        gl.uniform3fv(location, current_material.albedo);
        location = gl.getUniformLocation(shaderProgram, 'matSpecular');
        gl.uniform3fv(location, current_material.specular);
        location = gl.getUniformLocation(shaderProgram, 'matN');
        gl.uniform1i(location, current_material.n);
    }

    function setUpLighting() {
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
