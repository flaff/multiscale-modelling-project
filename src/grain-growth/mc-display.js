import React, {Component} from 'react';
import './mc-display.css';

class MonteCarloDisplay extends Component {

    componentDidUpdate() {
        this.props.onDrawStart && this.props.onDrawStart();
        this.refs.canvas && this.updateCanvas();
        this.props.onDrawEnd && this.props.onDrawEnd();
    }

    updateCanvas() {
        const width = this.props.matrix.length,
            height = this.props.matrix[0].length,
            c = this.refs.canvas.getContext('2d');

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const rgb = this.props.matrix[x][y].id;
                    // prevRgba = c.getImageData(x, y, 1, 1).data,
                    // prevRgb = [prevRgba[0], prevRgba[1], prevRgba[2]].join(',');

                // if (rgb !== prevRgb) {
                    c.fillStyle = `rgb(${rgb})`;
                    c.fillRect(x,y,1,1);
                // }
            }
        }
    }

    onCanvasClick(event) {
        if (this.props.onGrainClick) {
            const boundingRectangle = this.refs.canvas.getBoundingClientRect(),
                canvasX = event.clientX - boundingRectangle.left,
                canvasY = event.clientY - boundingRectangle.top,

                x = Math.floor((canvasX / boundingRectangle.width) * this.props.matrix.length),
                y = Math.floor((canvasY / boundingRectangle.height) * this.props.matrix[0].length);

            const
                grain = this.props.matrix[x][y];

            this.props.onGrainClick({grain, x, y});
        }
    }

    render() {
        const width = this.props.matrix.length,
            height = this.props.matrix[0].length;
        return (
            <div className="display">
                <canvas className={'canvasCss'} ref="canvas" width={width} height={height} onClick={this.onCanvasClick.bind(this)} />
            </div>
        );
    }
}

export default MonteCarloDisplay;
