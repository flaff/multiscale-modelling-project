const
    CellType = {
    EMPTY: '255,255,255',
    INCLUSION: '0,0,0'
},
    Neighbourhood = {
        MOORE: [
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1]
        ],
        NEAREST_MOORE: [
            [0, 1, 0],
            [1, 0, 1],
            [0, 1, 0],
        ],
        FURTHER_MOORE: [
            [1, 0, 1],
            [0, 0, 0],
            [1, 0, 1],
        ]
    },

    getNeighbourhoodName = function (neighbourhood) {
        const names = Object.keys(Neighbourhood);
        for (let i = 0; i < names.length; i++) {
            if (neighbourhood === Neighbourhood[names[i]]) {
                return names[i];
            }
        }
    },

    InclusionShape = {
        SQUARE: 'Square',
        CIRCLE: 'Circle'
    },

    ComplexNeighbourhood = {
        COMPLEX_MOORE: 'COMPLEX_MOORE'
    },

    ClearNonStaticMode = {
        STANDARD: 'STANDARD',
        DUAL_PHASE: 'DUAL_PHASE'
    },

    ComputationMode = {
        CA: 'CA',
        MONTE_CARLO: 'MONTE_CARLO',
        SRX_MONTE_CARLO: 'SRX_MONTE_CARLO'
    },

    NucleationMode = {
        EVERYWHERE: 'EVERYWHERE',
        BORDERS: 'BORDERS'
    },

    NucleationIncrement = {
        CONST: 'CONST',
        INCREASING: 'INCREASING',
        ONCE: 'ONCE'
    },

    InclusionShapesList = Object.keys(InclusionShape).map((key) => InclusionShape[key]),

    NeighbourhoodClassicList = Object.keys(Neighbourhood).map((key) => ({value: key, label: key})),
    NeighbourhoodComplexList = Object.keys(ComplexNeighbourhood).map((key) => ({value: key, label: key})),
    NeighbourhoodList = NeighbourhoodClassicList.concat(NeighbourhoodComplexList);

export {
    CellType,
    Neighbourhood,
    ComplexNeighbourhood,
    NeighbourhoodList,
    getNeighbourhoodName,
    ClearNonStaticMode,

    NucleationIncrement,
    NucleationMode,

    InclusionShape,
    InclusionShapesList,
    ComputationMode
}