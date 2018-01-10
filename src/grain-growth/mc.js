import React, {Component} from 'react';
import MonteCarloDisplay from './mc-display';
import {createMatrix} from './utils/mc-logic';
import {bufferToBase64, CanvasToBMP} from './utils/bitmap-utils';
import {bufferToString} from './utils/text-utils';
import {saveAs} from '../lib/index';
import Base64Image from './utils/base64-image';
import {
    CellType, Neighbourhood, getNeighbourhoodName, NeighbourhoodList, ComplexNeighbourhood, ClearNonStaticMode,
    NucleationMode, NucleationIncrement
} from './grain-growth.consts';
import {InclusionShape, InclusionShapesList, ComputationMode} from './grain-growth.consts';
import './mc.css';
import ProgressBar from './progressbar';

const
    defaultUnspreadableCellTypes = [CellType.EMPTY, CellType.INCLUSION],
    unspreadableCellTypes = [],
    rcxCellTypes = [],

    AFTER_RCX_ENERGY = 0;

let randomIdsCache = null;

function getCoordinatesAsArray(matrix) {
    const cellsXY = [];
    for (let x = 0; x < matrix.length; x++) {
        for (let y = 0; y < matrix[0].length; y++) {
            cellsXY.push({x, y});
        }
    }
    return cellsXY;
}

function addNucleations(matrix, nucleationMode, amount) {
    for (let i = 0; i < amount; i++) {
        const {x, y} = nucleationMode === NucleationMode.BORDERS ?
            getRandomGrainBorder(matrix) : getRandomCoordinates(matrix);

        if (matrix[x][y].H !== AFTER_RCX_ENERGY) {
            matrix[x][y].id = 127 + randomInt(128) + ',0,0';
            (rcxCellTypes.indexOf(matrix[x][y].id) === -1) && rcxCellTypes.push(matrix[x][y].id);
            matrix[x][y].H = AFTER_RCX_ENERGY;
        }
    }
}

function getRandomElement(array) {
    return array[Math.floor(array.length * Math.random())];
}

function getMatrixAvaiableIds(matrix) {
    const cache = [];
    for (let x = 0; x < matrix.length; x++) {
        for (let y = 0; y < matrix[0].length; y++) {
            cache.indexOf(matrix[x][y].id) === -1 && cache.push(matrix[x][y].id);
        }
    }
    randomIdsCache = cache;
    return randomIdsCache;
}

function randomInt(value) {
    return Math.floor(Math.random() * value);
}

const RedMax = 180, HMax = 20, HMin = 0;

function toEnergyCell(cell) {
    const
        // randomEnergy = Math.floor(Math.random() * 20),
        r = cell.H === 0 ? 255 : (RedMax - Math.floor(RedMax * ((cell.H || 0) - HMin) / (HMax - HMin))),
        b = 255 - r,
        rgb = [r, 8, b];

    return {
        id: rgb.join(',')
    }
}

function toEnergyMatrix(matrix) {
    const energyMatrix = [];

    for (let x = 0; x < matrix[0].length; x++) {
        const column = [];
        for (let y = 0; y < matrix[0].length; y++) {
            column.push(toEnergyCell(matrix[x][y]));
        }
        energyMatrix.push(column);
    }

    return energyMatrix;
}

/** returns {Array} */
function getUnspreadableCellTypes() {
    return defaultUnspreadableCellTypes.concat(unspreadableCellTypes);
}

function getCustomUnspreadableCellTypes() {
    return unspreadableCellTypes;
}

function addUnspreadableCellType(cellType) {
    if (unspreadableCellTypes.indexOf(cellType) === -1) {
        unspreadableCellTypes.push(cellType);
    }
}

function removeUnspreadableCellType(cellType) {
    const index = unspreadableCellTypes.indexOf(cellType);
    if (index !== -1) {
        unspreadableCellTypes.splice(cellType, 1);
    }
}

function resetUnspreadableCellTypes() {
    while (unspreadableCellTypes.length) {
        unspreadableCellTypes.pop();
    }
}


function getRandomCoordinates(matrix) {
    const width = matrix.length, height = matrix[0].length;
    return {
        x: Math.floor(Math.random() * width),
        y: Math.floor(Math.random() * height)
    }
}

function getNeighbours(matrix, i, j, neighbourhood) {
    // const neighbourhoodName = getNeighbourhoodName(neighbourhood);
    //
    // if (matrix[i][j].neighbours && matrix[i][j].neighbours[neighbourhoodName]) {
    //     return matrix[i][j].neighbours[neighbourhoodName];
    // } else if (!matrix[i][j].neighbours) {
    //     matrix[i][j].neighbours = {};
    // }

    const neighbours = [],
        width = matrix.length,
        height = matrix[0].length,
        nWidth = neighbourhood.length,
        nHeight = neighbourhood[0].length,
        xStart = -(nWidth - 1) / 2,
        xEnd = (nWidth - 1) / 2,
        yStart = -(nHeight - 1) / 2,
        yEnd = (nHeight - 1) / 2;

    for (let x = xStart; x <= xEnd; x++) {
        for (let y = yStart; y <= yEnd; y++) {
            // out of bounds check
            if ((i + x >= 0 && i + x < width) && (j + y >= 0 && j + y < height)) {
                const isInNeighbourhood = neighbourhood[x - xStart][y - yStart];
                isInNeighbourhood && neighbours.push(matrix[x + i][y + j]);
            }
        }
    }

    // matrix[i][j].neighbours[neighbourhoodName] = neighbours;
    return neighbours;
}

function getIdCount(neighbours) {
    const idCount = {};

    for (let i = 0; i < neighbours.length; i++) {
        idCount[neighbours[i].id] = idCount[neighbours[i].id] ? (idCount[neighbours[i].id] + 1) : 1;
    }

    return idCount;
}

function getGreatestId(idCount) {
    let greatestId = CellType.EMPTY, greatestIdCount = 0;

    const keys = Object.keys(idCount),
        unspreadableCellTypes = getUnspreadableCellTypes();
    for (let k = 0; k < keys.length; k++) {
        if (greatestIdCount < idCount[keys[k]] && unspreadableCellTypes.indexOf(keys[k]) === -1) {
            greatestIdCount = idCount[keys[k]];
            greatestId = keys[k];
        }
    }
    return greatestId;
}

function getNextCellState_classic(matrix, i, j, neighbourhoodType = Neighbourhood.MOORE) {
    const
        neighbours = getNeighbours(matrix, i, j, neighbourhoodType),
        idCount = getIdCount(neighbours),
        greatestId = getGreatestId(idCount);

    return greatestId ? {...matrix[i][j], id: greatestId} : matrix[i][j];
}

function getNextCellState_mooreComplex(matrix, i, j, probability) {
    // rule 1
    const mooreNeighbours = getNeighbours(matrix, i, j, Neighbourhood.MOORE),
        mooreIdCount = getIdCount(mooreNeighbours),
        mooreGreatestId = getGreatestId(mooreIdCount);

    if (mooreIdCount[mooreGreatestId] > 5) {
        return {...matrix[i][j], id: mooreGreatestId};
    }

    // rule 2
    const nearestMooreNeighbours = getNeighbours(matrix, i, j, Neighbourhood.NEAREST_MOORE),
        nearestMooreIdCount = getIdCount(nearestMooreNeighbours),
        nearestMooreGreatestId = getGreatestId(nearestMooreIdCount);

    if (nearestMooreIdCount[nearestMooreGreatestId] === 3) {
        return {...matrix[i][j], id: nearestMooreGreatestId};
    }

    // rule 3
    const furtherMooreNeighbours = getNeighbours(matrix, i, j, Neighbourhood.FURTHER_MOORE),
        furtherMooreIdCount = getIdCount(furtherMooreNeighbours),
        furtherMooreGreatestId = getGreatestId(furtherMooreIdCount);

    if (furtherMooreIdCount[furtherMooreGreatestId] === 3) {
        return {...matrix[i][j], id: furtherMooreGreatestId};
    }

    // rule 4
    const randomNumber = Math.floor(Math.random() * 100);
    if (randomNumber <= probability) {
        return {...matrix[i][j], id: mooreGreatestId};
    }

    return matrix[i][j];
}

function addCell(matrix, i, j, cell) {
    const x = i === undefined ? Math.floor(Math.random() * matrix.length) : i,
        y = j === undefined ? Math.afloor(Math.random() * matrix[0].length) : j;

    matrix[x][y] = cell;

    return matrix;
}

let __cache__getRandomGrainBorder_matrixResults = null,
    __cache__getRandomGrainBorder_matrix = null;

function getRandomGrainBorder(matrix, forceAll) {
    let results = void 0;

    if (matrix === __cache__getRandomGrainBorder_matrix) {
        results = __cache__getRandomGrainBorder_matrixResults;
    } else {
        results = [];

        const width = matrix.length,
            height = matrix[0].length,
            unspreadableCellTypes = getUnspreadableCellTypes();

        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                // count neighbours
                const idCount = {};
                for (let x = -1; x <= 1; x++) {
                    for (let y = -1; y <= +1; y++) {
                        if (i + x >= 0 && i + x < width && j + y >= 0 && j + y < height && (x || y)) {
                            const neighbour = matrix[i + x][j + y];
                            if (unspreadableCellTypes.indexOf(neighbour.id) === -1 || forceAll) {
                                idCount[neighbour.id] = idCount[neighbour.id] ? (idCount[neighbour.id] + 1) : 1;
                            }
                        }
                    }
                }

                if (Object.keys(idCount).length > 1) {
                    results.push({x: i, y: j});
                }
            }
        }

        __cache__getRandomGrainBorder_matrixResults = results;
        __cache__getRandomGrainBorder_matrix = matrix;
    }

    return getRandomElement(results);
}

function getAllGrainBorders(matrix) {
    getRandomGrainBorder(matrix, true);
    return __cache__getRandomGrainBorder_matrixResults;
}

function createRandomId() {
    return Math.floor(Math.random() * 255) + ',' + Math.floor(Math.random() * 255) + ',' + Math.floor(Math.random() * 255);
}

function addRandomCell(matrix, i, j) {
    const id = createRandomId(),
        cell = {...matrix[i][j], id};
    return addCell(matrix, i, j, cell);
}

function addInclusion_square(matrix, x, y, diagonal) {
    const width = Math.round(diagonal / Math.sqrt(2));
    for (let i = -Math.floor(width / 2); i <= Math.ceil(width / 2); i++) {
        for (let j = -Math.floor(width / 2); j <= Math.ceil(width / 2); j++) {
            // absorbing boundary condition check
            if (x + i >= 0 && x + i < matrix.length && y + j >= 0 && y + j < matrix.length) {
                addCell(matrix, x + i, y + j, {id: CellType.INCLUSION});
            }
        }
    }
}

function addInclusion_circle(matrix, x, y, radius) {
    for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= +radius; j++) {
            // absorbing boundary condition check
            if (x + i >= 0 && x + i < matrix.length && y + j >= 0 && y + j < matrix.length) {
                // radius check
                const a = Math.abs(i), b = Math.abs(j);
                if (Math.sqrt(a * a + b * b) <= radius) {
                    addCell(matrix, x + i, y + j, {id: CellType.INCLUSION});
                }
            }
        }
    }
}

class MonteCarlo extends Component {
    constructor() {
        super();

        this.state = {
            matrix: createMatrix(1, 1, CellType.EMPTY),
            nextSteps: 100,
            width: 100,
            height: 100,
            nucleons: 40,
            step: 0,
            inclusionShape: InclusionShape.SQUARE,
            inclusionAmount: 4,
            inclusionSize: 5,
            benchmarkComputationTime: 0,
            benchmarkDrawTime: 0,
            selectedNeighbourhoodType: getNeighbourhoodName(Neighbourhood.MOORE),
            probability: 10,
            unspreadableCellTypes: [],
            borderThickness: 2,
            computationMode: ComputationMode.CA,
            nucleationMode: NucleationMode.BORDERS,
            nucleationIncrement: NucleationIncrement.ONCE,
            nucleationIncrementValue: 10,
            currentNucleationValue: 0,
            homogenousDistribution: 2
        };
    }


    onAddBorderClick(thickness) {
        const borderlineGrains = getAllGrainBorders(this.state.matrix),
            matrix = JSON.parse(JSON.stringify(this.state.matrix));

        for (let i = 0; i < borderlineGrains.length; i++) {
            const {x, y} = borderlineGrains[i];
            addInclusion_square(matrix, x, y, thickness - 1);
        }

        this.setState({
            ...this.state,
            matrix
        });
    }

    onSetBordersAsEnergyClick() {
        const borderlineGrains = getAllGrainBorders(this.state.matrix),
            matrix = JSON.parse(JSON.stringify(this.state.matrix));

        for (let i = 0; i < borderlineGrains.length; i++) {
            const {x, y} = borderlineGrains[i];
            matrix[x][y].H = Math.floor(10 + Math.random() * (HMax - 10));
        }

        this.setState({
            ...this.state,
            matrix
        });
    }


    addInclusion(times = this.state.inclusionAmount) {
        const matrix = this.state.matrix,
            shape = this.state.inclusionShape,
            size = this.state.inclusionSize;

        for (let t = 0; t < times; t++) {
            let x, y;

            if (this.state.step > 2) {
                const randomGrainBorder = getRandomGrainBorder(matrix);
                x = randomGrainBorder.x;
                y = randomGrainBorder.y;
            } else {
                x = Math.floor(Math.random() * matrix.length);
                y = Math.floor(Math.random() * matrix[0].length);
            }

            if (shape === InclusionShape.SQUARE) {
                addInclusion_square(matrix, x, y, size);
            } else if (shape === InclusionShape.CIRCLE) {
                addInclusion_circle(matrix, x, y, size);
            }
        }

        this.setState({matrix});
    }

    fillWithNucleons(nucleons = 1) {
        const matrix = this.state.matrix,
            nucleonIds = [],
            staticIdsWithoutEmpty = getUnspreadableCellTypes().filter((ct) => ct !== CellType.EMPTY);

        for (let i = 0; i < nucleons; i++) {
            nucleonIds.push(createRandomId());
        }

        randomIdsCache = nucleonIds;

        for (let x = 0; x < matrix.length; x++) {
            for (let y = 0; y < matrix[0].length; y++) {
                if (staticIdsWithoutEmpty.indexOf(matrix[x][y].id) === -1) {
                    matrix[x][y] = {
                        ...matrix[x][y],
                        id: getRandomElement(nucleonIds)
                    }
                }
            }
        }

        this.setState({
            ...this.state,
            matrix
        });
    }

    addRandomCell(times = 1) {
        let matrix = this.state.matrix;
        for (let t = 0; t < times; t++) {
            let triesLeft = 5,
                {x, y} = getRandomCoordinates(matrix);

            while (matrix[x][y].id !== CellType.EMPTY && triesLeft) {
                const coordinates = getRandomCoordinates(matrix);
                x = coordinates.x;
                y = coordinates.y;
                triesLeft--;
            }

            triesLeft && addRandomCell(matrix, x, y);
        }

        this.setState({matrix});
    }

    exportToPng() {
        const canvas = this.refs.display.refs.canvas,
            // urlWithBase64 = canvas.toDataURL(),
            // base64 = urlWithBase64.replace('data:image/png;base64,', ''),
            // blob = base64toBlob(base64, 'image/bmp');
            blob = CanvasToBMP.toBlob(canvas);

        saveAs(blob, 'matrix.bmp');
    }

    exportToTxt() {
        const blob = new Blob([JSON.stringify(this.state.matrix)], {type: 'text/plain'});
        saveAs(blob, 'matrix.txt');
    }

    reset() {
        resetUnspreadableCellTypes();
        this.setState({
            matrix: createMatrix(1, 1, CellType.EMPTY),
            nextSteps: 100,
            width: 100,
            height: 100,
            nucleons: 40,
            step: 0,
            benchmarkComputationTime: 0,
            probability: 10,
            unspreadableCellTypes: [],
            clearNonStaticMode: ClearNonStaticMode.STANDARD,
            borderThickness: 2,
            percentDone: 0,
            computationMode: ComputationMode.CA
        });
    }

    initMatrix() {
        const matrix = createMatrix(this.state.width, this.state.height, CellType.EMPTY);
        this.setState({...this.state, step: 1, matrix});
    }

    computeNextStep_CA(matrix, neighbourhoodName) {
        const isComplexMethod = Object.keys(ComplexNeighbourhood).indexOf(neighbourhoodName) !== -1,
            probablity = this.state.probability,
            neighbourhoodType = Neighbourhood[neighbourhoodName],
            prevMatrix = this.state.matrix;

        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix[0].length; j++) {
                if (matrix[i][j].id === CellType.EMPTY) {
                    if (isComplexMethod) {
                        matrix[i][j] = getNextCellState_mooreComplex(prevMatrix, i, j, probablity);
                    } else {
                        matrix[i][j] = getNextCellState_classic(prevMatrix, i, j, neighbourhoodType);
                    }
                }
            }
        }

        return matrix;
    }

    computeNextStep_SRXMonteCarlo(matrix, neighbourhoodName) {
        // get list of all cooridinates
        const cellsXY = getCoordinatesAsArray(matrix),
            neighbourhood = Neighbourhood[neighbourhoodName];

        // pop random cell and compute its energy
        while (cellsXY.length) {

            const
                randomCellIndex = randomInt(cellsXY.length),
                {x, y} = cellsXY.splice(randomCellIndex, 1)[0],
                neighbours = getNeighbours(matrix, x, y, neighbourhood),

                randomNeighbour = getRandomElement(neighbours),
                randomId = randomNeighbour.id,
                isRandomNeighbourRcx = randomNeighbour.H === AFTER_RCX_ENERGY,

                energyBefore = neighbours.filter(n => n.id !== matrix[x][y].id).length + matrix[x][y].H,

                afterH = isRandomNeighbourRcx ? AFTER_RCX_ENERGY : matrix[x][y].H,
                energyAfter = neighbours.filter(n => n.id !== randomId).length + afterH;

            if (matrix[x][y].H === AFTER_RCX_ENERGY) {
                continue;
            }

            if (energyAfter < energyBefore) {
                matrix[x][y].id = randomId;
                matrix[x][y].H = afterH;
            }
        }

        return matrix;
    }

    computeNextStep_MonteCarlo(matrix, neighbourhoodName) {
        // get list of all cooridinates
        const cellsXY = getCoordinatesAsArray(matrix),
            neighbourhood = Neighbourhood[neighbourhoodName],
            staticCellTypes = getUnspreadableCellTypes(),
            availableIds = (getMatrixAvaiableIds(matrix)).filter((id) => staticCellTypes.indexOf(id) === -1);

        // pop random cell and compute its energy
        while (cellsXY.length) {
            const
                randomCellIndex = randomInt(cellsXY.length),
                {x, y} = cellsXY.splice(randomCellIndex, 1)[0], // pop from stack

                neighbours = getNeighbours(matrix, x, y, neighbourhood),
                randomId = getRandomElement(availableIds),

                energyBefore = neighbours.filter(({id}) => id !== matrix[x][y].id).length,
                energyAfter = neighbours.filter(({id}) => id !== randomId).length;

            if (energyAfter < energyBefore) {
                matrix[x][y].id = randomId;
            }
        }

        return matrix;
    }

    computeNextStep(times = 1, totalTimes) {
        let prevMatrix = this.state.matrix,
            neighbourhoodName = this.state.selectedNeighbourhoodType,
            matrix,
            nucleationIncrementValue = 0;

        if (!totalTimes) {
            totalTimes = times;
        }

        if ((this.state.nucleationIncrement === NucleationIncrement.INCREASING) ||
            (this.state.nucleationIncrement === NucleationIncrement.CONST && times === this.state.nextSteps)) {
            nucleationIncrementValue = this.state.nucleationIncrementValue;
        }

        matrix = JSON.parse(JSON.stringify(prevMatrix));

        if (this.state.computationMode === ComputationMode.MONTE_CARLO) {
            matrix = this.computeNextStep_MonteCarlo(matrix, neighbourhoodName);
        } else if (this.state.computationMode === ComputationMode.CA) {
            matrix = this.computeNextStep_CA(matrix, neighbourhoodName);
        } else if (this.state.computationMode === ComputationMode.SRX_MONTE_CARLO) {
            nucleationIncrementValue && addNucleations(matrix, this.state.nucleationMode, nucleationIncrementValue);

            matrix = this.computeNextStep_SRXMonteCarlo(matrix, neighbourhoodName);
        }

        prevMatrix = matrix;

        this.setState({
            ...this.state,
            prevMatrix,
            matrix,
            step: this.state.step + 1,
            percentDone: 100 * (totalTimes - times) / totalTimes
        });

        times && setTimeout(() => {
            this.computeNextStep(times - 1, totalTimes);
        }, 5);

    }

    clearNonStaticGrains() {
        const staticCellTypes = getUnspreadableCellTypes(),
            matrix = JSON.parse(JSON.stringify(this.state.matrix)),
            customUnspreadableCellTypes = getCustomUnspreadableCellTypes(),
            monoCellType = customUnspreadableCellTypes.length ? customUnspreadableCellTypes[0] : null;

        for (let x = 0; x < matrix.length; x++) {
            for (let y = 0; y < matrix[0].length; y++) {
                if (staticCellTypes.indexOf(matrix[x][y].id) === -1) {
                    matrix[x][y].id = CellType.EMPTY;
                } else if (defaultUnspreadableCellTypes.indexOf(matrix[x][y].id) === -1
                    && this.state.clearNonStaticMode === ClearNonStaticMode.DUAL_PHASE
                    && staticCellTypes.length) {
                    matrix[x][y].id = monoCellType;
                }
            }
        }

        if (this.state.clearNonStaticMode === ClearNonStaticMode.DUAL_PHASE && staticCellTypes.length > 1) {
            resetUnspreadableCellTypes();
            addUnspreadableCellType(monoCellType);
        }

        this.setState({
            ...this.state,
            matrix,
            unspreadableCellTypes: getCustomUnspreadableCellTypes()
        });
    }

    importTxt() {
        const input = document.getElementById('txtInput');

        if (input && input.files && input.files.length) {
            const
                file = input.files[0],
                reader = new FileReader();

            reader.addEventListener('load', this.importTxt_processText.bind(this), false);
            reader.readAsArrayBuffer(file);
        }
    }

    importTxt_processText(event) {
        const buffer = event.target.result,
            string = bufferToString(buffer),
            matrix = JSON.parse(string),
            width = matrix.length,
            height = matrix[0].length;

        this.setState({...this.state, matrix, width, height, step: 1});

        document.getElementById('txtInput').value = null;
    }

    importPng_processImage(event) {
        const buffer = event.target.result,
            base64 = bufferToBase64(buffer);

        const image = document.createElement('IMG');

        image.onload = function () {
            const
                canvas = document.createElement('CANVAS'),
                ctx = canvas.getContext('2d'),
                width = image.width,
                height = image.height;

            ctx.drawImage(image, 0, 0);

            const matrix = [];

            for (let i = 0; i < width; i++) {
                matrix.push([]);
            }

            for (let h = 0; h < height; h++) {
                const row = ctx.getImageData(0, h, width, 1).data;

                for (let i = 0; i < row.length; i = i + 4) {
                    const x = (i / 4) % width,
                        r = row[i],
                        g = row[i + 1],
                        b = row[i + 2];

                    matrix[x].push({
                        id: `${r},${g},${b}`
                    })
                }
            }

            this.setState({...this.state, matrix, width, height, step: 1});
        }.bind(this);

        image.src = 'data:image/png;base64,' + base64;


        const input = document.getElementById('bmpInput');
        input.value = null;
    }

    importPng() {
        const input = document.getElementById('bmpInput');

        if (input && input.files && input.files.length) {
            const
                file = input.files[0],
                reader = new FileReader();

            reader.addEventListener('load', this.importPng_processImage.bind(this), false);
            file && reader.readAsArrayBuffer(file);
        }
    }

    onGrainClick({grain}) {
        if ((this.state.unspreadableCellTypes.concat(defaultUnspreadableCellTypes)).indexOf(grain.id) === -1) {
            addUnspreadableCellType(grain.id);

            this.setState({
                ...this.state,
                unspreadableCellTypes: getCustomUnspreadableCellTypes()
            });
        }
    }

    onStaticGrainRemoveClick(id) {
        removeUnspreadableCellType(id);
        this.setState({
            ...this.state,
            unspreadableCellTypes: getCustomUnspreadableCellTypes()
        })
    }

    onNextStepsInputChange(event) {
        this.setState({...this.state, nextSteps: +event.target.value});
    }

    onNucleonsInputChange(event) {
        this.setState({...this.state, nucleons: +event.target.value});
    }

    onWidthInputChange(event) {
        this.setState({...this.state, width: +event.target.value});
    }

    onHeightInputChange(event) {
        this.setState({...this.state, height: +event.target.value});
    }

    onInclusionShapeSelectChange(event) {
        this.setState({...this.state, inclusionShape: event.target.value});
    }

    onInclusionAmountInputChange(event) {
        this.setState({...this.state, inclusionAmount: +event.target.value});
    }

    onInclusionSizeInputChange(event) {
        this.setState({...this.state, inclusionSize: +event.target.value});
    }

    onNeighbourhoodTypeSelectChange(event) {
        this.setState({...this.state, selectedNeighbourhoodType: event.target.value});
    }

    onProbabilityInputChange(event) {
        this.setState({...this.state, probability: +event.target.value});
    }

    onHomogenousDistributionInputChange(event) {
        this.setState({...this.state, homogenousDistribution: event.target.value});
    }

    onDistributeHomogenouslyEnergyClick() {
        const matrix = JSON.parse(JSON.stringify(this.state.matrix));

        for (let x = 0; x < matrix.length; x++) {
            for (let y = 0; y < matrix[0].length; y++) {
                matrix[x][y].H = this.state.homogenousDistribution;
            }
        }

        this.setState({...this.state, matrix});
    }

    onComputationModeSelectChange(event) {
        this.setState({...this.state, computationMode: event.target.value});
    }

    onNucleationModeChange(event) {
        this.setState({...this.state, nucleationMode: event.target.value});
    }

    onNucleationIncrementChange(event) {
        this.setState({
            ...this.state, nucleationIncrement: event.target.value,
            currentNucleationValue: event.target.value === NucleationIncrement.INCREASING ? 0 : this.state.nucleationIncrementValue
        });
    }

    onNucleationIncrementAmountChange(event) {
        this.setState({...this.state, nucleationIncrementValue: +event.target.value});
    }

    onAddNucleationsClick() {
        const matrix = JSON.parse(JSON.stringify(this.state.matrix));

        addNucleations(matrix, this.state.nucleationMode, this.state.nucleationIncrementValue);

        this.setState({...this.state, matrix});
    }

    onClearNonStaticModeChange(event) {
        this.setState({
            ...this.state,
            clearNonStaticMode: event.target.value
        })
    }

    onBorderThicknessChange(event) {
        this.setState({
            ...this.state,
            borderThickness: +event.target.value
        })
    }

    render() {
        return (
            <div>

                <div>
                    <div style={{margin: '0 auto', display: 'inline-block'}}>
                        <MonteCarloDisplay matrix={this.state.matrix} prevMatrix={this.state.prevMatrix}
                                           onGrainClick={this.onGrainClick.bind(this)}
                                           ref={'display'}/>

                        {this.state.computationMode === ComputationMode.SRX_MONTE_CARLO &&
                        <MonteCarloDisplay matrix={toEnergyMatrix(this.state.matrix)}
                                           onGrainClick={this.onGrainClick.bind(this)}
                                           ref={'energyDisplay'}/>
                        }
                    </div>
                </div>

                <ProgressBar percent={this.state.percentDone}/>

                {this.state.computationMode === ComputationMode.SRX_MONTE_CARLO && (<div>
                    <div className={'row'}>
                        <div className={'col-lg-1'}/>

                        <div className={'col-lg-4'}>
                            <div className="input-group">
                                <span className="input-group-addon">Homogenous energy distribution</span>
                                <input value={this.state.homogenousDistribution}
                                       disabled={this.state.computationMode !== ComputationMode.SRX_MONTE_CARLO || !this.state.step}
                                       onChange={this.onHomogenousDistributionInputChange.bind(this)}
                                       className="form-control"/>

                                <button className="btn btn-outline-primary" onClick={this.onDistributeHomogenouslyEnergyClick.bind(this)}
                                        disabled={this.state.computationMode !== ComputationMode.SRX_MONTE_CARLO || !this.state.step}>
                                    Distribute
                                </button>
                            </div>
                        </div>

                        <div className={'col-lg-2'}/>

                        <div className={'col-lg-3'} style={{textAlign: 'right', marginTop: '10px'}}>
                            <button className="btn btn-outline-primary" onClick={this.onSetBordersAsEnergyClick.bind(this)}
                                    disabled={this.state.computationMode !== ComputationMode.SRX_MONTE_CARLO || !this.state.step}>
                                Add Energy on Borders
                            </button>
                        </div>

                    </div>

                    <div style={{margin: '15px 0'}}/>


                    <div className={'row'}>
                        <div className={'col-lg-1'}/>

                        <div className={'col-lg-3'}>
                            <select value={this.state.nucleationMode}
                                    onChange={this.onNucleationModeChange.bind(this)}
                                    disabled={this.state.computationMode !== ComputationMode.SRX_MONTE_CARLO || !this.state.step}
                                    className="form-control">
                                {Object.keys(NucleationMode).map((key) =>
                                    (<option value={NucleationMode[key]} key={key}>{key}</option>))
                                }
                            </select>
                        </div>

                        <div className={'col-lg-3'}>
                            <select value={this.state.nucleationIncrement}
                                    onChange={this.onNucleationIncrementChange.bind(this)}
                                    disabled={this.state.computationMode !== ComputationMode.SRX_MONTE_CARLO || !this.state.step}
                                    className="form-control">
                                {Object.keys(NucleationIncrement).map((key) =>
                                    (<option value={NucleationIncrement[key]} key={key}>{key}</option>))
                                }
                            </select>
                        </div>

                        <div className={'col-lg-3'}>
                            <div className="input-group">
                                <input type="text" className="form-control"
                                       disabled={this.state.computationMode !== ComputationMode.SRX_MONTE_CARLO || !this.state.step}
                                       value={this.state.nucleationIncrementValue}
                                       onChange={this.onNucleationIncrementAmountChange.bind(this)}/>
                                {
                                    (this.state.nucleationIncrement === NucleationIncrement.ONCE) &&
                                    <button className="btn btn-outline-primary" onClick={this.onAddNucleationsClick.bind(this)}
                                            disabled={this.state.computationMode !== ComputationMode.SRX_MONTE_CARLO || !this.state.step}>
                                        Add
                                    </button>
                                }
                            </div>
                        </div>
                    </div>
                </div>)
                }

                <div style={{margin: '15px 0'}}/>

                <div className={'row'}>
                    <div className={'col-lg-1'}/>

                    <div className={'col-lg-4'}>
                        <div className="input-group">
                            <span className="input-group-addon">Steps</span>
                            <input type="text"
                                   className="form-control"
                                   value={this.state.nextSteps}
                                   onChange={this.onNextStepsInputChange.bind(this)}/>
                            <button className="btn btn-outline-primary"
                                    onClick={() => this.computeNextStep(this.state.nextSteps)}
                                    disabled={!this.state.step}>Compute
                            </button>
                        </div>
                    </div>

                    <div className={'col-lg-1'}/>

                    <div className={'col-lg-2'}>
                        <button className="btn btn-outline-danger"
                                onClick={() => this.state.step ? this.reset() : this.initMatrix()}>{this.state.step ? 'reset' : 'initialize'}</button>
                    </div>
                    <div className={'col-lg-2'}>
                        <select value={this.state.computationMode}
                                onChange={this.onComputationModeSelectChange.bind(this)}
                                className="form-control">
                            {Object.keys(ComputationMode).map((key) =>
                                (<option value={ComputationMode[key]} key={key}>{key}</option>))
                            }
                        </select>
                    </div>
                </div>

                <div style={{margin: '15px 0'}}/>

                <div className="row">
                    <div className="col-lg-1"/>

                    <div className="col-lg-4">
                        <div className="input-group">
                            <span className="input-group-addon">Neuclons</span>
                            <input type="text" className="form-control"
                                   value={this.state.nucleons}
                                   onChange={this.onNucleonsInputChange.bind(this)}/>

                            {this.state.computationMode === ComputationMode.MONTE_CARLO && (
                                <button className="btn btn-outline-success"
                                        onClick={() => this.fillWithNucleons(this.state.nucleons)}
                                        disabled={!this.state.step}>Fill
                                </button>
                            )}

                            {this.state.computationMode === ComputationMode.CA && (
                                <button className="btn btn-outline-success"
                                        onClick={() => this.addRandomCell(this.state.nucleons)}
                                        disabled={!this.state.step}>Add
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="col-lg-1"/>

                    <div className="col-lg-4">
                        <div className="input-group">
                            <span className="input-group-addon">width:</span>
                            <input type="text" className="form-control"
                                   value={this.state.width}
                                   onChange={this.onWidthInputChange.bind(this)}
                                   disabled={!!this.state.step}/>

                            <span className="input-group-addon">height:</span>
                            <input type="text" className="form-control"
                                   value={this.state.height}
                                   onChange={this.onHeightInputChange.bind(this)}
                                   disabled={!!this.state.step}/>
                        </div>
                    </div>

                    <div className="col-lg-1"/>

                </div>

                <div style={{margin: '15px 0'}}/>

                <div className="row">
                    <div className="col-lg-1"/>

                    <div className="col-lg-4">
                        <div className="input-group">
                            <span className="input-group-addon">png import:</span>
                            <input type="file" className="form-control" id="bmpInput"
                                   onChange={this.importPng.bind(this)}/>

                            <button className="btn btn-outline-primary"
                                    onClick={() => this.exportToPng()}
                                    disabled={!this.state.step}>export
                            </button>
                        </div>
                    </div>

                    <div className="col-lg-1"/>

                    <div className="col-lg-4">
                        <div className="input-group">
                            <span className="input-group-addon">txt import:</span>
                            <input type="file" className="form-control" id="txtInput"
                                   onChange={this.importTxt.bind(this)}/>

                            <button className="btn btn-outline-primary"
                                    onClick={() => this.exportToTxt()}
                                    disabled={!this.state.step}>export
                            </button>
                            <Base64Image base64={this.state.base64}/>
                        </div>
                    </div>

                    <div className="col-lg-1"/>

                </div>

                <div style={{margin: '15px 0'}}/>

                <div className="row">
                    <div className={'col-lg-1'}/>

                    <div className={'col-lg-9'}>
                        <div className="input-group">
                            <span className="input-group-addon">Static grains</span>
                            <span className="input-group-addon">
                                <div className="unspreadableCellContainer">
                                    {defaultUnspreadableCellTypes.map((id) => (
                                        <div className="unspreadableCell" style={{background: `rgb(${id})`}}
                                             key={id}></div>
                                    ))}
                                </div>
                            </span>
                            <span className="input-group-addon">
                                <div className="unspreadableCellContainer">
                                    {this.state.unspreadableCellTypes.map((id) => (
                                        <div className="customUnspreadableCell" style={{background: `rgb(${id})`}}
                                             key={id}
                                             onClick={() => this.onStaticGrainRemoveClick(id)}></div>
                                    ))}
                                </div>
                            </span>
                            <select value={this.state.clearNonStaticMode}
                                    onChange={this.onClearNonStaticModeChange.bind(this)}
                                    className="form-control">
                                {Object.keys(ClearNonStaticMode).map((key) =>
                                    (<option value={ClearNonStaticMode[key]} key={key}>{key}</option>))
                                }
                            </select>
                            <button className="btn btn-outline-danger"
                                    onClick={this.clearNonStaticGrains.bind(this)}>Clear non-static
                            </button>

                            <span className="input-group-addon">Border thickness</span>
                            <input type="text"
                                   className="form-control"
                                   value={this.state.borderThickness}
                                   onChange={this.onBorderThicknessChange.bind(this)}/>
                            <button className="btn btn-outline-primary"
                                    onClick={() => this.onAddBorderClick(this.state.borderThickness)}>Add border
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{margin: '15px 0'}}/>

                <div className="row">

                    <div className="col-lg-1"/>

                    <div className="col-lg-9">
                        <div className="input-group">
                            <span className="input-group-addon">inclusion:</span>

                            <select className="form-control"
                                    value={this.state.inclusionShape}
                                    onChange={this.onInclusionShapeSelectChange.bind(this)}>
                                {InclusionShapesList.map((shape) => (
                                    <option value={shape} key={shape}>{shape}</option>
                                ))}
                            </select>


                            <span className="input-group-addon">
                                {this.state.inclusionShape === InclusionShape.CIRCLE ? 'radius' : 'diagonal'}:
                            </span>

                            <input type="text" className="form-control"
                                   value={this.state.inclusionSize}
                                   onChange={this.onInclusionSizeInputChange.bind(this)}/>

                            <span className="input-group-addon">amount:</span>

                            <input type="text" className="form-control"
                                   value={this.state.inclusionAmount}
                                   onChange={this.onInclusionAmountInputChange.bind(this)}/>

                            <button className="btn btn-outline-primary"
                                    onClick={() => this.addInclusion()}
                                    disabled={!this.state.step}>Add
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{margin: '15px 0'}}/>

                <div className="row">
                    <div className="col-lg-1"/>

                    <div className="col-lg-4">

                        <div className="input-group">
                            <span className="input-group-addon">neighbourhood:</span>

                            <select className="form-control" value={this.state.selectedNeighbourhoodType}
                                    onChange={this.onNeighbourhoodTypeSelectChange.bind(this)}>
                                {NeighbourhoodList.map(({value, label}) => (
                                    <option value={value} key={value}>{label || value}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="col-lg-1"/>

                    <div className="col-lg-4">

                        <div className="input-group">
                            <span className="input-group-addon">probability:</span>

                            <input type="text" className="form-control"
                                   value={this.state.probability}
                                   onChange={this.onProbabilityInputChange.bind(this)}/>

                            <span className="input-group-addon">%</span>
                        </div>
                    </div>
                </div>

                <div style={{margin: '15px 0'}}/>


            </div>
        )
    }
}

export default MonteCarlo
