import React, {Component} from 'react';
import MonteCarloDisplay from './mc-display';
import {createMatrix} from "./utils/mc-logic";
import {bufferToBase64, CanvasToBMP} from "./utils/bitmap-utils";
import {bufferToString} from "./utils/text-utils";
import {saveAs} from "../lib/index";
import Base64Image from './utils/base64-image';
import {CellType, Neighbourhood, getNeighbourhoodName, NeighbourhoodList, ComplexNeighbourhood, ClearNonStaticMode} from "./grain-growth.consts";
import {InclusionShape, InclusionShapesList} from "./grain-growth.consts";
import './mc.css';

const
    defaultUnspreadableCellTypes = [CellType.EMPTY, CellType.INCLUSION],
    unspreadableCellTypes = [];

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
        y = j === undefined ? Math.floor(Math.random() * matrix[0].length) : j;

    matrix[x][y] = cell;

    return matrix;
}
let __cache__getRandomGrainBorder_matrixResults = null,
    __cache__getRandomGrainBorder_matrix =  null;
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

    return results[Math.floor(Math.random() * results.length)];
}

function getAllGrainBorders(matrix) {
    getRandomGrainBorder(matrix, true);
    return __cache__getRandomGrainBorder_matrixResults;
}

function addRandomCell(matrix, i, j) {
    const id = Math.floor(Math.random() * 255) + ',' + Math.floor(Math.random() * 255) + ',' + Math.floor(Math.random() * 255),
        cell = {id};
    return addCell(matrix, i, j, cell);
}

function addInclusion_square(matrix, x, y, diagonal) {
    const width = Math.round(diagonal / Math.sqrt(2));
    for (let i = -Math.floor(width/2); i <= Math.ceil(width/2); i++) {
        for (let j = -Math.floor(width/2); j <= Math.ceil(width/2); j++) {
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

let drawTimeStart = void 0;

class MonteCarlo extends Component {
    constructor() {
        super();

        this.state = {
            matrix: createMatrix(1, 1, CellType.EMPTY),
            nextSteps: 5,
            width: 100,
            height: 100,
            nucleons: 15,
            step: 0,
            inclusionShape: InclusionShape.SQUARE,
            inclusionAmount: 4,
            inclusionSize: 5,
            benchmarkComputationTime: 0,
            benchmarkDrawTime: 0,
            selectedNeighbourhoodType: getNeighbourhoodName(Neighbourhood.MOORE),
            probability: 10,
            unspreadableCellTypes: [],
            borderThickness: 2
        };
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
            nextSteps: 5,
            width: 100,
            height: 100,
            nucleons: 15,
            step: 0,
            benchmarkComputationTime: 0,
            probability: 10,
            unspreadableCellTypes: [],
            clearNonStaticMode: ClearNonStaticMode.STANDARD,
            borderThickness: 2
        });
    }

    initMatrix() {
        const matrix = createMatrix(this.state.width, this.state.height, CellType.EMPTY);
        this.setState({...this.state, step: 1, matrix});
    }

    computeNextStep(times = 1) {
        const isComplexMethod = Object.keys(ComplexNeighbourhood).indexOf(this.state.selectedNeighbourhoodType) !== -1,
            probablity = this.state.probability;

        let prevMatrix = this.state.matrix,
            step = this.state.step,
            neighbourhoodType = Neighbourhood[this.state.selectedNeighbourhoodType],
            matrix,
            avgTime = 0;

        for (let t = 0; t < times; t++) {
            const iterationTime = Number(new Date());
            matrix = JSON.parse(JSON.stringify(prevMatrix));

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

            step = step + 1;
            prevMatrix = matrix;

            const nowTime = Number(new Date());
            avgTime += nowTime - iterationTime;
        }

        avgTime = avgTime/times;
        this.setState({...this.state, prevMatrix, matrix, step: this.state.step + 1, benchmarkComputationTime: avgTime});
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


    onDrawStart() {
        drawTimeStart = +(new Date());
    }

    onDrawEnd() {
        const drawTimeEnd = +(new Date());
        this.refs.drawTimeInput.value = (drawTimeEnd - drawTimeStart) + 'ms';
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

    render() {
        return (
            <div>

                <MonteCarloDisplay matrix={this.state.matrix} prevMatrix={this.state.prevMatrix}
                                   onDrawStart={this.onDrawStart.bind(this)} onDrawEnd={this.onDrawEnd.bind(this)}
                                   onGrainClick={this.onGrainClick.bind(this)}
                                ref={'display'} />


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

                    <div className={'col-lg-4'}>
                        <button className="btn btn-outline-danger"
                                onClick={() => this.state.step ? this.reset() : this.initMatrix()}>{this.state.step ? 'reset' : 'initialize'}</button>
                    </div>
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
                                        <div className="unspreadableCell" style={{background: `rgb(${id})`}} key={id}></div>
                                    ))}
                                </div>
                            </span>
                            <span className="input-group-addon">
                                <div className="unspreadableCellContainer">
                                    {this.state.unspreadableCellTypes.map((id) => (
                                        <div className="customUnspreadableCell" style={{background: `rgb(${id})`}} key={id}
                                             onClick={() => this.onStaticGrainRemoveClick(id)}></div>
                                    ))}
                                </div>
                            </span>
                            <select value={this.state.clearNonStaticMode} onChange={this.onClearNonStaticModeChange.bind(this)}
                                    className="form-control" >
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

                    <div className="col-lg-4">
                        <div className="input-group">
                            <span className="input-group-addon">Neuclons</span>
                            <input type="text" className="form-control"
                                   value={this.state.nucleons}
                                   onChange={this.onNucleonsInputChange.bind(this)}/>

                            <button className="btn btn-outline-success"
                                    onClick={() => this.addRandomCell(this.state.nucleons)}
                                    disabled={!this.state.step}>Add
                            </button>
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

                    <div className="col-lg-1" />

                </div>


                <div style={{margin: '15px 0'}}/>

                <div className="row">
                    <div className="col-lg-1" />

                    <div className="col-lg-4">

                        <div className="input-group">
                            <span className="input-group-addon">neighbourhood:</span>

                            <select className="form-control" value={this.state.selectedNeighbourhoodType} onChange={this.onNeighbourhoodTypeSelectChange.bind(this)}>
                                {NeighbourhoodList.map(({value, label}) => (
                                    <option value={value} key={value}>{label || value}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="col-lg-1" />

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

                <div className="row">

                    <div className="col-lg-1" />

                    <div className="col-lg-9">
                        <div className="input-group">
                            <span className="input-group-addon">inclusion:</span>

                            <select className="form-control"
                                value={this.state.inclusionShape} onChange={this.onInclusionShapeSelectChange.bind(this)}>
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
                    <div className="col-lg-1" />

                    <div className="col-lg-4">
                        <div className="input-group">
                            <span className="input-group-addon">computation time:</span>

                            <input className="form-control" disabled={true} value={this.state.benchmarkComputationTime + 'ms'} />
                        </div>
                    </div>

                    <div className="col-lg-1" />

                    <div className="col-lg-4">
                        <div className="input-group">
                            <span className="input-group-addon">draw time:</span>

                            <input className="form-control" disabled={true} ref="drawTimeInput" />
                        </div>
                    </div>
                </div>


                <div style={{margin: '15px 0'}}/>

            </div>
        )
    }
}

export default MonteCarlo
