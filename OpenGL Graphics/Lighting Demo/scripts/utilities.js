

//------------------------------------------------------------------
//
// Helper function used to load a file from the server
//
//------------------------------------------------------------------
function loadFileFromServer(filename) {
    return fetch(filename)
        .then(res => res.text());
}

//------------------------------------------------------------------
//
// Helper function to multiply two 4x4 matrices.
//
//------------------------------------------------------------------
function multiplyMatrix4x4(m1, m2) {
    let r = [
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0];

    // Iterative multiplication
    // for (let i = 0; i < 4; i++) {
    //     for (let j = 0; j < 4; j++) {
    //         for (let k = 0; k < 4; k++) {
    //             r[i * 4 + j] += m1[i * 4 + k] * m2[k * 4 + j];
    //         }
    //     }
    // }

    // "Optimized" manual multiplication
    r[0] = m1[0] * m2[0] + m1[1] * m2[4] + m1[2] * m2[8] + m1[3] * m2[12];
    r[1] = m1[0] * m2[1] + m1[1] * m2[5] + m1[2] * m2[9] + m1[3] * m2[13];
    r[2] = m1[0] * m2[2] + m1[1] * m2[6] + m1[2] * m2[10] + m1[3] * m2[14];
    r[3] = m1[0] * m2[3] + m1[1] * m2[7] + m1[2] * m2[11] + m1[3] * m2[15];

    r[4] = m1[4] * m2[0] + m1[5] * m2[4] + m1[6] * m2[8] + m1[7] * m2[12];
    r[5] = m1[4] * m2[1] + m1[5] * m2[5] + m1[6] * m2[9] + m1[7] * m2[13];
    r[6] = m1[4] * m2[2] + m1[5] * m2[6] + m1[6] * m2[10] + m1[7] * m2[14];
    r[7] = m1[4] * m2[3] + m1[5] * m2[7] + m1[6] * m2[11] + m1[7] * m2[15];

    r[8] = m1[8] * m2[0] + m1[9] * m2[4] + m1[10] * m2[8] + m1[11] * m2[12];
    r[9] = m1[8] * m2[1] + m1[9] * m2[5] + m1[10] * m2[9] + m1[11] * m2[13];
    r[10] = m1[8] * m2[2] + m1[9] * m2[6] + m1[10] * m2[10] + m1[11] * m2[14];
    r[11] = m1[8] * m2[3] + m1[9] * m2[7] + m1[10] * m2[11] + m1[11] * m2[15];

    r[12] = m1[12] * m2[0] + m1[13] * m2[4] + m1[14] * m2[8] + m1[15] * m2[12];
    r[13] = m1[12] * m2[1] + m1[13] * m2[5] + m1[14] * m2[9] + m1[15] * m2[13];
    r[14] = m1[12] * m2[2] + m1[13] * m2[6] + m1[14] * m2[10] + m1[15] * m2[14];
    r[15] = m1[12] * m2[3] + m1[13] * m2[7] + m1[14] * m2[11] + m1[15] * m2[15];

    return r;
}

//------------------------------------------------------------------
//
// Transpose a matrix.
// Reference: https://jsperf.com/transpose-2d-array
//
//------------------------------------------------------------------
function transposeMatrix4x4(m) {
    let t = [
        m[0], m[4], m[8], m[12],
        m[1], m[5], m[9], m[13],
        m[2], m[6], m[10], m[14],
        m[3], m[7], m[11], m[15]
    ];
    return t;
}

function readPlyAsObject(filename) {
    return loadFileFromServer(filename).then(text => {
        
        let header_lines = text.split('end_header\n')[0].split('\n');
        let lines = text.split('end_header\n')[1].split('\n');
        let vcount, fcount;
        header_lines.forEach(line => {
            if (line.startsWith('element vertex')) {
                vcount = parseInt(line.split(' ')[2]);
                console.log(vcount);
            } else if (line.startsWith('element face')) {
                fcount = parseInt(line.split(' ')[2]);
            }
            if (vcount + fcount < lines.length) {
                console.log(`Warning: ${lines.length - vcount - fcount} unused line(s) in file ${filename}`);
            } else if (vcount + fcount > lines.length) {
                console.log(`Warning: header predicts ${vcount + fcount} lines in ${filename}, found only ${vcount + fcount - lines.length}. Make sure model data is correct.`);
            }
        });
        let vertices = [];
        let maxSize = 0;
        let adjacency = [];
        let triNormals = [];
        let vertNormals = [];

        for (let i = 0; i < vcount; i++) {
            let v = lines[i].split(' ');
            for (let j = 0; j < 3; j++) {
                let val = parseFloat(v[j]);
                if (isNaN(val)) continue;
                vertices.push(val);
                if (Math.abs(val) > maxSize) {
                    maxSize = Math.abs(val);
                }
            }
            adjacency.push([]);
        }
        for (let i = 0; i < vertices.length; i++) {
            vertices[i] /= maxSize;
        }
        let faces = [];
        for (let i = vcount; i < lines.length; i++) {
            let line = lines[i].split(' ');
            if (parseInt(line[0]) == 3) {
                let i1 = parseInt(line[1]);
                let i2 = parseInt(line[2]);
                let i3 = parseInt(line[3]);
                adjacency[i1].push(i);
                adjacency[i2].push(i);
                adjacency[i3].push(i);
                faces.push(i1);
                faces.push(i2);
                faces.push(i3);
                triNormals[i] = computeTriNormals(i1, i2, i3, vertices);
            }
            else {
                console.log(`Non-triangular face discarded at line ${i} in ${filename}`);
            }
        }
        for (let i = 0; i < vcount; i++) {
            let normSum = [0, 0, 0];

            for (let j = 0; j < adjacency[i].length; j++) {
                normSum[0] += triNormals[adjacency[i][j]][0];
                normSum[1] += triNormals[adjacency[i][j]][1];
                normSum[2] += triNormals[adjacency[i][j]][2];
            }
            vertNormals.push(normSum[0] / adjacency[i].length);
            vertNormals.push(normSum[1] / adjacency[i].length);
            vertNormals.push(normSum[2] / adjacency[i].length);
        }
        let shape = {
            vertices: new Float32Array(vertices),
            indices: new Uint32Array(faces),
            vertexNormals: new Float32Array(vertNormals),  
        };
        return shape;
    });

    function computeTriNormals(i1, i2, i3, vertices) {
        let p1 = vertices.slice(i1*3, 3*i1+3);
        let p2 = vertices.slice(i2*3, 3*i2+3);
        let p3 = vertices.slice(i3*3, 3*i3+3);

        let w = [p2[0] - p3[0], p2[1] - p3[1], p2[2] - p3[2]];
        let v = [p1[0] - p3[0], p1[1] - p3[1], p1[2] - p3[2]];

        let norm = [
            w[1]*v[2] - w[2]*v[1],
            w[2]*v[0] - w[0]*v[2],
            w[0]*v[1] - w[1]*v[0]
        ];
        let mag = Math.sqrt(norm[0] * norm[0] + norm[1] * norm[1] + norm[2] * norm[2]);
        console.log(mag);
        if (!isNaN(mag) && mag != 0) {
            norm[0] /= mag;
            norm[1] /= mag;
            norm[2] /= mag;
        }
        
        return norm;
    }
    
}
