import { Game } from './game/Game.js';

const game = new Game(document.getElementById('game'));
game.start();

// Handy for poking at things from the console.
window.game = game;
