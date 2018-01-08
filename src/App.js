import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import './bootstrap.css';
import GrainGrowth from './grain-growth/mc';

class App extends Component {
  render() {
    return (
      <div className="App">
          <img src={logo} className="App-logo" alt="logo" />
          <GrainGrowth />
      </div>
    );
  }
}

export default App;
