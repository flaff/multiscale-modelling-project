import React from 'react';
import './progressbar.css';

export default function Progressbar({percent}) {
    return (
        <div className="progressbar">
            <div className="progressbar-fill" style={{width: percent + '%'}} />
        </div>
    )
}