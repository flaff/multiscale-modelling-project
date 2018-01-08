import React from 'react';

export default function Base64Image({ base64, alt }) {
    return base64 ? (
        <img src={`data:image/png;base64, ${base64}`} alt={alt} />
    ) : null;
}
