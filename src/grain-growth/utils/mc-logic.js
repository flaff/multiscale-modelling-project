function createCell(id) {
    return {id, H: 2}
}

function createMatrix(width, height, id) {
    const matrix = [];

    for (let i = 0; i < width; i++) {
        const column = [];

        for (let j = 0; j < height; j++) {
            column.push(createCell(id));
        }

        matrix.push(column);
    }

    return matrix;
}

export {createMatrix}
