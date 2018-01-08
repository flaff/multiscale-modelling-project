// http://www.i-programmer.info/projects/36-web/6234-reading-a-bmp-file-in-javascript.html?start=1
/* eslint-disable */

function bufferToBase64( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}

function bufferToImage(buffer) {
    var datav = new DataView(buffer);
    var bitmap = {};

    bitmap.fileheader = {};
    bitmap.fileheader.bfType = datav.getUint16(0, true);
    bitmap.fileheader.bfSize = datav.getUint32(2, true);
    bitmap.fileheader.bfReserved1 = datav.getUint16(6, true);
    bitmap.fileheader.bfReserved2 = datav.getUint16(8, true);
    bitmap.fileheader.bfOffBits = datav.getUint32(10, true);

    bitmap.infoheader = {};
    bitmap.infoheader.biSize = datav.getUint32(14, true);
    bitmap.infoheader.biWidth = datav.getUint32(18, true);
    bitmap.infoheader.biHeight = datav.getUint32(22, true);
    bitmap.infoheader.biPlanes = datav.getUint16(26, true);
    bitmap.infoheader.biBitCount = datav.getUint16(28, true);
    bitmap.infoheader.biCompression = datav.getUint32(30, true);
    bitmap.infoheader.biSizeImage = datav.getUint32(34, true);
    bitmap.infoheader.biXPelsPerMeter = datav.getUint32(38, true);
    bitmap.infoheader.biYPelsPerMeter = datav.getUint32(42, true);
    bitmap.infoheader.biClrUsed = datav.getUint32(46, true);
    bitmap.infoheader.biClrImportant = datav.getUint32(50, true);

    var start = bitmap.fileheader.bfOffBits;
    bitmap.stride = Math.floor((bitmap.infoheader.biBitCount * bitmap.infoheader.biWidth + 31) / 32) * 4;
    bitmap.pixels = new Uint8Array(buffer, start);

    return bitmap;
}

function imageToData(bitmap, utilCanvas = document.createElement('CANVAS')) {
    var ctx = utilCanvas.getContext("2d");
    var Width = bitmap.infoheader.biWidth;
        var Height = bitmap.infoheader.biHeight;
        var imageData = ctx.createImageData(
            Width, Height);

    var data = imageData.data;
    var bmpdata = bitmap.pixels;
    var stride = bitmap.stride;

    for (var y = 0; y < Height; ++y) {
        for (var x = 0; x < Width; ++x) {
            var index1 = (x+Width*(Height-y))*4;
            var index2 = x * 3 + stride * y;
            data[index1] = bmpdata[index2 + 2];
            data[index1 + 1] = bmpdata[index2 + 1];
            data[index1 + 2] = bmpdata[index2];
            data[index1 + 3] = 255;
        }
    }

    return imageData;
}

function base64toBlob(base64, contentType, sliceSize) {
    contentType = contentType || '';
    sliceSize = sliceSize || 512;

    var byteCharacters = atob(base64);
    var byteArrays = [];

    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        var slice = byteCharacters.slice(offset, offset + sliceSize);

        var byteNumbers = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        var byteArray = new Uint8Array(byteNumbers);

        byteArrays.push(byteArray);
    }

    var blob = new Blob(byteArrays, {type: contentType});
    return blob;
}

/*! canvas-to-bmp version 1.0 ALPHA
    (c) 2015 Ken "Epistemex" Fyrstenberg
    MIT License (this header required)
*/
const CanvasToBMP = {

    /**
     * Convert a canvas element to ArrayBuffer containing a BMP file
     * with support for 32-bit (alpha).
     *
     * Note that CORS requirement must be fulfilled.
     *
     * @param {HTMLCanvasElement} canvas - the canvas element to convert
     * @return {ArrayBuffer}
     */
    toArrayBuffer: function(canvas) {

        var w = canvas.width,
            h = canvas.height,
            w4 = w * 4,
            idata = canvas.getContext("2d").getImageData(0, 0, w, h),
            data32 = new Uint32Array(idata.data.buffer), // 32-bit representation of canvas

            stride = Math.floor((32 * w + 31) / 32) * 4, // row length incl. padding
            pixelArraySize = stride * h,                 // total bitmap size
            fileLength = 122 + pixelArraySize,           // header size is known + bitmap

            file = new ArrayBuffer(fileLength),          // raw byte buffer (returned)
            view = new DataView(file),                   // handle endian, reg. width etc.
            pos = 0, x, y = 0, p, s = 0, a, v;

        // write file header
        setU16(0x4d42);          // BM
        setU32(fileLength);      // total length
        pos += 4;                // skip unused fields
        setU32(0x7a);            // offset to pixels

        // DIB header
        setU32(108);             // header size
        setU32(w);
        setU32(-h >>> 0);        // negative = top-to-bottom
        setU16(1);               // 1 plane
        setU16(32);              // 32-bits (RGBA)
        setU32(3);               // no compression (BI_BITFIELDS, 3)
        setU32(pixelArraySize);  // bitmap size incl. padding (stride x height)
        setU32(2835);            // pixels/meter h (~72 DPI x 39.3701 inch/m)
        setU32(2835);            // pixels/meter v
        pos += 8;                // skip color/important colors
        setU32(0xff0000);        // red channel mask
        setU32(0xff00);          // green channel mask
        setU32(0xff);            // blue channel mask
        setU32(0xff000000);      // alpha channel mask
        setU32(0x57696e20);      // " win" color space

        // bitmap data, change order of ABGR to BGRA
        while (y < h) {
            p = 0x7a + y * stride; // offset + stride x height
            x = 0;
            while (x < w4) {
                v = data32[s++];                     // get ABGR
                a = v >>> 24;                        // alpha channel
                view.setUint32(p + x, (v << 8) | a); // set BGRA
                x += 4;
            }
            y++
        }

        return file;

        // helper method to move current buffer position
        function setU16(data) {view.setUint16(pos, data, true); pos += 2}
        function setU32(data) {view.setUint32(pos, data, true); pos += 4}
    },

    /**
     * Converts a canvas to BMP file, returns a Blob representing the
     * file. This can be used with URL.createObjectURL().
     * Note that CORS requirement must be fulfilled.
     *
     * @param {HTMLCanvasElement} canvas - the canvas element to convert
     * @return {Blob}
     */
    toBlob: function(canvas) {
        return new Blob([this.toArrayBuffer(canvas)], {
            type: "image/bmp"
        });
    },

    /**
     * Converts the canvas to a data-URI representing a BMP file.
     * Note that CORS requirement must be fulfilled.
     *
     * @param canvas
     * @return {string}
     */
    toDataURL: function(canvas) {
        var buffer = new Uint8Array(this.toArrayBuffer(canvas)),
            bs = "", i = 0, l = buffer.length;
        while (i < l) bs += String.fromCharCode(buffer[i++]);
        return "data:image/bmp;base64," + btoa(bs);
    }
};

export {
    CanvasToBMP,
    bufferToBase64,
    bufferToImage,
imageToData,
    base64toBlob
}