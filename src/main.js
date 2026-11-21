import './style.css';
import './game/index.js';
import { connect } from './net/connect.js';

// The game exposes its network seam as window.ravenNet; connect() swaps in Firebase when src/net/config.js is filled
// in. Firebase is only needed in the city, so it loads when the browser is idle after the garage is up, or at once
// when you drive into the city first (the game calls window.ravenConnectNow), whichever comes first.
let connecting = false;
window.ravenConnectNow = () => { if (connecting) return; connecting = true; connect(window.ravenNet); };
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
idle(window.ravenConnectNow, { timeout: 4000 });
