// Main game variables
let audioContext = null;
let audioSource = null;
let gainNode = null;
let audioBuffer = null;
let isPlaying = false;
let isMusicEnabled = false;
let musicVolume = 50;

// Game state
let gameState = 'loading'; // loading, menu, settings, playing, gameOver
let loadingProgress = 0;
let assetsLoaded = false;
let gameScore = 0;
let gameLevel = 1;
let gameLines = 0;
let isPaused = false;

// Tetris game constants
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 30;
const LEVEL_SPEED = [800, 650, 500, 400, 300, 250, 200, 150, 100, 80, 50];

// Tetrimino shapes with theme colors
const TETRIMINOS = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: "#4EA8DE", // Blue
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#FFC857", // Yellow
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#A06CD5", // Purple
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#57CC99", // Green
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#FF7B00", // Orange
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: "#FF8FA3", // Light Pink
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: "#FF4D6D", // Pink
  },
};

// Game variables
let board = [];
let currentPiece = null;
let nextPiece = null;
let currentPosition = { x: 0, y: 0 };
let dropInterval = null;
let lineClearSound = null;

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const loadingCanvas = document.getElementById('loading-canvas');
const loadingProgressElement = document.getElementById('loading-progress');
const gameMenu = document.getElementById('game-menu');
const settingsMenu = document.getElementById('settings-menu');
const tetrisGame = document.getElementById('tetris-game');
const gameOver = document.getElementById('game-over');
const tetrisBackground = document.getElementById('tetris-background');
const gameBoard = document.getElementById('game-board');
const nextPiecePreview = document.getElementById('next-piece-preview');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const linesDisplay = document.getElementById('lines-display');
const finalScoreValue = document.getElementById('final-score-value');
const pauseOverlay = document.getElementById('pause-overlay');

// Initialize the game
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Start loading assets
  loadAssets();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize the loading animation
  initLoadingAnimation();
}

// Load game assets
async function loadAssets() {
  try {
    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    
    // Load music
    const musicResponse = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%E3%83%86%E3%83%88%E3%83%AA%E3%82%B9%20%20%E9%87%8D%E9%9F%B3%E3%83%86%E3%83%88SV%20%20Tetoris%20%28AI%20Filtered%20Instrumental%29%20%5B%20ezmp3.cc%20%5D-Cw297e6Q0rSy6snRGIDbDL6q9TIhxB.mp3"
    );
    const musicArrayBuffer = await musicResponse.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(musicArrayBuffer);
    
    // Load sound effects
    const lineClearResponse = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/NES%20Tetris%20Sound%20Effect_%20Tetris%20Clear%20%5B%20ezmp3.cc%20%5D-5XTgKAM6n0llLgC1JaFq5SiOKAVHzA.mp3"
    );
    const lineClearArrayBuffer = await lineClearResponse.arrayBuffer();
    const lineClearBuffer = await audioContext.decodeAudioData(lineClearArrayBuffer);
    lineClearSound = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/NES%20Tetris%20Sound%20Effect_%20Tetris%20Clear%20%5B%20ezmp3.cc%20%5D-5XTgKAM6n0llLgC1JaFq5SiOKAVHzA.mp3");
    
    // Load image for loading screen
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-sigqQurVHNjXNGBUyMl0JVn13QDLLH.png";
    
    await new Promise(resolve => {
      img.onload = () => {
        // Store the image for the loading animation
        window.loadingImage = img;
        resolve();
      };
    });
    
    assetsLoaded = true;
    
    // Start simulating loading progress
    simulateLoading();
  } catch (error) {
    console.error("Error loading assets:", error);
    // Continue anyway to show the game
    assetsLoaded = true;
    simulateLoading();
  }
}

// Simulate loading progress
function simulateLoading() {
  const interval = setInterval(() => {
    loadingProgress += 1;
    loadingProgressElement.textContent = `${loadingProgress}%`;
    
    drawLoadingAnimation();
    
    if (loadingProgress >= 100) {
      clearInterval(interval);
      
      // Add a small delay before showing the menu
      setTimeout(() => {
        showScreen('menu');
      }, 500);
    }
  }, 50);
}

// Initialize loading animation
function initLoadingAnimation() {
  drawLoadingAnimation();
}

// Draw the loading animation on canvas
function drawLoadingAnimation() {
  const canvas = loadingCanvas;
  const ctx = canvas.getContext('2d');
  
  if (!ctx || !window.loadingImage) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const img = window.loadingImage;
  
  // Calculate the size to maintain aspect ratio
  const size = Math.min(canvas.width, canvas.height) * 0.8;
  const aspectRatio = img.width / img.height;
  const width = aspectRatio >= 1 ? size : size * aspectRatio;
  const height = aspectRatio >= 1 ? size / aspectRatio : size;
  
  // Center the image
  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2;
  
  // Draw the original image (grayscale version)
  ctx.drawImage(img, x, y, width, height);
  
  // Apply grayscale filter to the entire image
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      // If pixel is not transparent
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; // Red
      data[i + 1] = avg; // Green
      data[i + 2] = avg; // Blue
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // Now draw the colored version with a wave-like mask based on loading progress
  ctx.save();
  
  // Create a clipping region for the wave effect
  ctx.beginPath();
  
  const waveHeight = 10; // Height of the wave
  const waveCount = 5; // Number of wave cycles
  
  const fillHeight = canvas.height - (canvas.height * loadingProgress) / 100;
  
  ctx.moveTo(0, canvas.height);
  
  // Create wavy top edge
  for (let i = 0; i <= canvas.width; i++) {
    const waveY = fillHeight + Math.sin((i / canvas.width) * Math.PI * 2 * waveCount) * waveHeight;
    ctx.lineTo(i, waveY);
  }
  
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.clip();
  
  // Draw the colored version
  ctx.drawImage(img, x, y, width, height);
  
  ctx.restore();
  
  // Draw pixel art border
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  
  // Draw pixel corners
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 8, 8);
  ctx.fillRect(canvas.width - 8, 0, 8, 8);
  ctx.fillRect(0, canvas.height - 8, 8, 8);
  ctx.fillRect(canvas.width - 8, canvas.height - 8, 8, 8);
}

// Set up event listeners
function setupEventListeners() {
  // Menu buttons
  document.getElementById('play-button').addEventListener('click', startGame);
  document.getElementById('settings-button').addEventListener('click', () => showScreen('settings'));
  document.getElementById('quit-button').addEventListener('click', () => window.open("https://www.youtube.com/watch?v=Soy4jGPHr3g", "_blank"));
  
  // Settings menu
  document.getElementById('settings-back').addEventListener('click', () => showScreen('menu'));
  document.getElementById('settings-return').addEventListener('click', () => showScreen('menu'));
  document.getElementById('music-toggle').addEventListener('change', handleMusicToggle);
  document.getElementById('volume-slider').addEventListener('input', handleVolumeChange);
  
  // Game controls
  document.getElementById('pause-button').addEventListener('click', togglePause);
  document.getElementById('restart-button').addEventListener('click', restartGame);
  document.getElementById('menu-button').addEventListener('click', returnToMenu);
  
  // Game over screen
  document.getElementById('play-again').addEventListener('click', restartGame);
  document.getElementById('return-menu').addEventListener('click', returnToMenu);
  
  // Keyboard controls
  window.addEventListener('keydown', handleKeyDown);
  
  // Initialize music toggle and volume
  document.getElementById('music-toggle').checked = isMusicEnabled;
  document.getElementById('volume-slider').value = musicVolume;
  document.getElementById('volume-value').textContent = musicVolume;
}

// Show specific screen
function showScreen(screen) {
  // Hide all screens
  loadingScreen.classList.add('hidden');
  gameMenu.classList.add('hidden');
  settingsMenu.classList.add('hidden');
  tetrisGame.classList.add('hidden');
  gameOver.classList.add('hidden');
  
  // Show requested screen
  switch (screen) {
    case 'loading':
      loadingScreen.classList.remove('hidden');
      break;
    case 'menu':
      gameMenu.classList.remove('hidden');
      gameState = 'menu';
      createTetrisBackground();
      if (isMusicEnabled && !isPlaying) {
        playMusic();
      }
      break;
    case 'settings':
      settingsMenu.classList.remove('hidden');
      gameState = 'settings';
      break;
    case 'playing':
      tetrisGame.classList.remove('hidden');
      gameState = 'playing';
      if (dropInterval === null) {
        startDropInterval();
      }
      break;
    case 'gameOver':
      gameOver.classList.remove('hidden');
      finalScoreValue.textContent = gameScore.toString().padStart(6, '0');
      gameState = 'gameOver';
      break;
  }
}

// Create tetris background with falling pieces
function createTetrisBackground() {
  tetrisBackground.innerHTML = '';
  
  const types = Object.keys(TETRIMINOS);
  const colors = ["#FF4D6D", "#FF8FA3", "#4EA8DE", "#57CC99", "#FFC857", "#A06CD5", "#FF7B00"];
  
  // Create 20 random tetriminos
  for (let i = 0; i < 20; i++) {
    const randomType = types[Math.floor(Math.random() * types.length)];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomX = Math.random() * 90; // Random position from 0-90%
    const randomDelay = Math.random() * 5; // Random delay for staggered effect
    
    const tetrimino = document.createElement('div');
    tetrimino.className = 'falling-tetrimino';
    tetrimino.style.left = `${randomX}%`;
    tetrimino.style.top = '-100px';
    tetrimino.style.position = 'absolute';
    
    // Create the tetrimino shape
    const shape = TETRIMINOS[randomType].shape;
    const tetriminoElement = document.createElement('div');
    
    shape.forEach(row => {
      const rowElement = document.createElement('div');
      rowElement.style.display = 'flex';
      
      row.forEach(cell => {
        const cellElement = document.createElement('div');
        cellElement.style.width = '20px';
        cellElement.style.height = '20px';
        
        if (cell) {
          cellElement.style.backgroundColor = randomColor;
          cellElement.style.border = '2px solid black';
          cellElement.style.boxShadow = 'inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 rgba(0,0,0,0.3)';
          cellElement.className = 'pixel-block';
        }
        
        rowElement.appendChild(cellElement);
      });
      
      tetriminoElement.appendChild(rowElement);
    });
    
    tetrimino.appendChild(tetriminoElement);
    tetrisBackground.appendChild(tetrimino);
    
    // Animate the tetrimino
    animateTetrimino(tetrimino, randomDelay);
  }
}

// Animate a falling tetrimino in the background
function animateTetrimino(element, delay) {
  const duration = 10 + Math.random() * 5;
  const rotationDuration = 5 + Math.random() * 10;
  
  setTimeout(() => {
    // Start falling animation
    element.style.transition = `transform ${duration}s linear, top ${duration}s linear`;
    element.style.top = '120vh';
    
    // Start rotation animation
    let rotation = 0;
    const rotateInterval = setInterval(() => {
      rotation += 90;
      element.style.transform = `rotate(${rotation}deg)`;
      
      if (rotation >= 360 * (duration / rotationDuration)) {
        clearInterval(rotateInterval);
      }
    }, rotationDuration * 1000 / 4);
    
    // Reset after animation completes
    setTimeout(() => {
      element.style.transition = 'none';
      element.style.top = '-100px';
      
      // Restart animation
      animateTetrimino(element, 0);
    }, duration * 1000);
  }, delay * 1000);
}

// Create TETORIS logo
function createTetorisLogo() {
  const logoContainer = document.getElementById('tetoris-logo');
  logoContainer.innerHTML = '';
  
  // Define the pixel art for each letter
  const pixelSize = 12;
  
  // T
  const T = [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ];
  
  // E
  const E = [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
    [1, 1, 1, 1],
  ];
  
  // O - special colored one
  const O = [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
  ];
  
  // R
  const R = [
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 0],
    [1, 0, 1, 0],
    [1, 0, 0, 1],
  ];
  
  // I
  const I = [
    [1, 1, 1],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1],
  ];
  
  // S
  const S = [
    [0, 1, 1, 1],
    [1, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 1],
    [1, 1, 1, 0],
  ];
  
  const letterData = [
    { letter: T, isSpecial: false },
    { letter: E, isSpecial: false },
    { letter: T, isSpecial: false },
    { letter: O, isSpecial: true },
    { letter: R, isSpecial: false },
    { letter: I, isSpecial: false },
    { letter: S, isSpecial: false },
  ];
  
  // Create each letter with animation
  letterData.forEach((item, letterIndex) => {
    const letterElement = document.createElement('div');
    letterElement.className = 'letter';
    letterElement.style.opacity = '0';
    letterElement.style.transform = 'translateY(-20px)';
    
    // Animate the letter
    setTimeout(() => {
      letterElement.style.transition = 'opacity 0.3s, transform 0.3s';
      letterElement.style.opacity = '1';
      letterElement.style.transform = 'translateY(0)';
    }, 100 * letterIndex);
    
    // Create the pixel grid for the letter
    item.letter.forEach((row, rowIndex) => {
      const rowElement = document.createElement('div');
      rowElement.style.display = 'flex';
      
      row.forEach((pixel, pixelIndex) => {
        const pixelElement = document.createElement('div');
        pixelElement.style.width = `${pixelSize}px`;
        pixelElement.style.height = `${pixelSize}px`;
        
        if (pixel) {
          pixelElement.style.backgroundColor = item.isSpecial ? '#333' : 'white';
          pixelElement.style.transform = 'scale(0)';
          pixelElement.className = 'shadow-sm';
          
          // Animate each pixel
          setTimeout(() => {
            pixelElement.style.transition = 'transform 0.3s';
            pixelElement.style.transform = 'scale(1)';
          }, 100 * letterIndex + 10 * (rowIndex + pixelIndex));
        } else {
          pixelElement.style.backgroundColor = 'transparent';
        }
        
        rowElement.appendChild(pixelElement);
      });
      
      letterElement.appendChild(rowElement);
    });
    
    logoContainer.appendChild(letterElement);
  });
}

// Handle music toggle
function handleMusicToggle(event) {
  isMusicEnabled = event.target.checked;
  
  if (isMusicEnabled) {
    if (!isPlaying) {
      playMusic();
    }
    if (gainNode) {
      gainNode.gain.value = musicVolume / 100;
    }
  } else {
    if (gainNode) {
      gainNode.gain.value = 0;
    }
  }
}

// Handle volume change
function handleVolumeChange(event) {
  musicVolume = parseInt(event.target.value);
  document.getElementById('volume-value').textContent = musicVolume;
  
  if (gainNode && isMusicEnabled) {
    gainNode.gain.value = musicVolume / 100;
  }
}

// Play background music
function playMusic() {
  if (!audioContext || !audioBuffer || !gainNode || isPlaying) return;
  
  // Resume audio context if it's suspended
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.loop = true;
  audioSource.connect(gainNode);
  
  // Set initial volume
  gainNode.gain.value = isMusicEnabled ? musicVolume / 100 : 0;
  
  audioSource.start(0);
  isPlaying = true;
  
  // Handle when the audio ends
  audioSource.onended = () => {
    isPlaying = false;
    if (isMusicEnabled) playMusic(); // Restart if music is still enabled
  };
}

// Play line clear sound
function playLineClearSound() {
  if (lineClearSound) {
    lineClearSound.currentTime = 0;
    lineClearSound.play().catch(err => console.error("Error playing sound:", err));
  }
}

// Start the game
function startGame() {
  // Initialize the game board
  initBoard();
  
  // Create initial pieces
  currentPiece = getRandomTetrimino();
  nextPiece = getRandomTetrimino();
  currentPosition = { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 };
  
  // Reset game stats
  gameScore = 0;
  gameLevel = 1;
  gameLines = 0;
  isPaused = false;
  
  // Update displays
  updateScoreDisplay();
  updateNextPieceDisplay();
  
  // Show the game screen
  showScreen('playing');
}

// Initialize the game board
function initBoard() {
  // Create empty board
  board = Array.from({ length: BOARD_HEIGHT }, () => 
    Array.from({ length: BOARD_WIDTH }, () => 0)
  );
  
  // Create board cells
  gameBoard.innerHTML = '';
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const cell = document.createElement('div');
      cell.className = 'game-cell';
      cell.id = `cell-${y}-${x}`;
      gameBoard.appendChild(cell);
    }
  }
}

// Get a random tetrimino
function getRandomTetrimino() {
  const tetriminos = Object.keys(TETRIMINOS);
  const randTetrimino = tetriminos[Math.floor(Math.random() * tetriminos.length)];
  return {
    ...TETRIMINOS[randTetrimino],
    type: randTetrimino,
  };
}

// Update the game board display
function updateBoardDisplay() {
  // Clear all cells
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const cell = document.getElementById(`cell-${y}-${x}`);
      if (cell) {
        if (board[y][x]) {
          cell.style.backgroundColor = board[y][x].color;
          cell.style.boxShadow = 'inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 rgba(0,0,0,0.3)';
        } else {
          cell.style.backgroundColor = 'transparent';
          cell.style.boxShadow = 'none';
        }
      }
    }
  }
  
  // Draw current piece
  if (!isPaused) {
    drawCurrentPiece();
  }
}

// Draw the current piece on the board
function drawCurrentPiece() {
  currentPiece.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        const boardY = currentPosition.y + y;
        const boardX = currentPosition.x + x;
        
        // Only draw if within board bounds
        if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
          const cellElement = document.getElementById(`cell-${boardY}-${boardX}`);
          if (cellElement) {
            cellElement.style.backgroundColor = currentPiece.color;
            cellElement.style.boxShadow = 'inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 rgba(0,0,0,0.3)';
          }
        }
      }
    });
  });
}

// Update the next piece display
function updateNextPieceDisplay() {
  nextPiecePreview.innerHTML = '';
  
  const shape = nextPiece.shape;
  const color = nextPiece.color;
  const previewSize = 18; // Slightly larger block size for preview
  
  // Calculate the actual dimensions of the piece
  const pieceWidth = shape[0].length;
  const pieceHeight = shape.length;
  
  // Calculate the total size the piece will occupy
  const totalWidth = pieceWidth * previewSize;
  const totalHeight = pieceHeight * previewSize;
  
  // Calculate offsets to center in the container
  const offsetX = (72 - totalWidth) / 2;
  const offsetY = (72 - totalHeight) / 2;
  
  // Create the preview container
  const previewContainer = document.createElement('div');
  previewContainer.className = 'relative w-full h-full';
  
  // Create each cell of the next piece
  shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        const cellElement = document.createElement('div');
        cellElement.className = 'absolute border-2 border-black';
        cellElement.style.width = `${previewSize}px`;
        cellElement.style.height = `${previewSize}px`;
        cellElement.style.backgroundColor = color;
        cellElement.style.left = `${offsetX + x * previewSize}px`;
        cellElement.style.top = `${offsetY + y * previewSize}px`;
        cellElement.style.boxShadow = 'inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 rgba(0,0,0,0.3)';
        
        previewContainer.appendChild(cellElement);
      }
    });
  });
  
  nextPiecePreview.appendChild(previewContainer);
}

// Update score display
function updateScoreDisplay() {
  scoreDisplay.textContent = gameScore.toString().padStart(6, '0');
  levelDisplay.textContent = gameLevel.toString().padStart(2, '0');
  linesDisplay.textContent = gameLines.toString().padStart(4, '0');
}

// Start the automatic dropping interval
function startDropInterval() {
  if (dropInterval) {
    clearInterval(dropInterval);
  }
  
  const dropSpeed = LEVEL_SPEED[Math.min(gameLevel - 1, LEVEL_SPEED.length - 1)];
  dropInterval = setInterval(() => {
    if (!isPaused && gameState === 'playing') {
      moveDown();
    }
  }, dropSpeed);
}

// Check for collisions
function checkCollision(piece, pos) {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      // If this is a filled square in the tetrimino
      if (piece.shape[y][x]) {
        const boardX = pos.x + x;
        const boardY = pos.y + y;
        
        // Check if outside board limits
        if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
          return true;
        }
        
        // Check if overlapping a placed piece (and not above the board)
        if (boardY >= 0 && board[boardY][boardX]) {
          return true;
        }
      }
    }
  }
  return false;
}

// Rotate a piece
function rotate(piece) {
  // Create a new rotated matrix
  const newShape = piece.shape.map((_, index) => 
    piece.shape.map(row => row[index]).reverse()
  );
  return { ...piece, shape: newShape };
}

// Try to rotate the current piece
function tryRotate() {
  const rotatedPiece = rotate(currentPiece);
  if (!checkCollision(rotatedPiece, currentPosition)) {
    currentPiece = rotatedPiece;
    updateBoardDisplay();
  }
}

// Move the piece horizontally
function moveHorizontal(direction) {
  if (gameState !== 'playing' || isPaused) return;
  
  const newPos = { ...currentPosition, x: currentPosition.x + direction };
  if (!checkCollision(currentPiece, newPos)) {
    currentPosition = newPos;
    updateBoardDisplay();
  }
}

// Move the piece down
function moveDown() {
  if (gameState !== 'playing' || isPaused) return;
  
  const newPos = { ...currentPosition, y: currentPosition.y + 1 };
  if (!checkCollision(currentPiece, newPos)) {
    currentPosition = newPos;
    updateBoardDisplay();
    return;
  }
  
  // Collision detected, lock the piece in place
  lockPiece();
}

// Hard drop the piece
function hardDrop() {
  if (gameState !== 'playing' || isPaused) return;
  
  // Find the lowest valid position
  let newY = currentPosition.y;
  let collisionDetected = false;
  
  while (!collisionDetected) {
    if (checkCollision(currentPiece, { x: currentPosition.x, y: newY + 1 })) {
      collisionDetected = true;
    } else {
      newY++;
    }
  }
  
  currentPosition.y = newY;
  updateBoardDisplay();
  
  // Lock the piece after a short delay
  setTimeout(() => {
    lockPiece();
  }, 50);
}

// Lock the current piece in place and get a new one
function lockPiece() {
  // Add the current piece to the board
  currentPiece.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        const boardY = currentPosition.y + y;
        const boardX = currentPosition.x + x;
        
        // Only update if within board bounds
        if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
          board[boardY][boardX] = currentPiece;
        }
      }
    });
  });
  
  // Check for completed lines
  const completedLines = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    if (board[y].every(cell => cell !== 0)) {
      completedLines.push(y);
    }
  }
  
  // Remove completed lines and add new empty rows
  if (completedLines.length > 0) {
    // Play line clear sound effect
    playLineClearSound();
    
    // Update score
    const linePoints = [40, 100, 300, 1200]; // Points for 1, 2, 3, and 4 lines
    const points = linePoints[Math.min(completedLines.length - 1, linePoints.length - 1)] * gameLevel;
    gameScore += points;
    
    // Update lines cleared count
    gameLines += completedLines.length;
    
    // Update level based on lines cleared
    gameLevel = Math.floor(gameLines / 10) + 1;
    
    // Remove the completed lines and add new empty rows
    const filteredBoard = board.filter((_, index) => !completedLines.includes(index));
    const newRows = Array.from({ length: completedLines.length }, () => 
      Array.from({ length: BOARD_WIDTH }, () => 0)
    );
    board = [...newRows, ...filteredBoard];
    
    // Update displays
    updateScoreDisplay();
    
    // Update drop speed based on new level
    startDropInterval();
  }
  
  // Update the board display
  updateBoardDisplay();
  
  // Check for game over
  if (currentPosition.y <= 0) {
    endGame();
    return;
  }
  
  // Get a new piece
  currentPiece = nextPiece;
  nextPiece = getRandomTetrimino();
  currentPosition = { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 };
  
  // Update next piece display
  updateNextPieceDisplay();
}

// End the game
function endGame() {
  if (dropInterval) {
    clearInterval(dropInterval);
    dropInterval = null;
  }
  
  showScreen('gameOver');
}

// Toggle pause state
function togglePause() {
  if (gameState !== 'playing') return;
  
  isPaused = !isPaused;
  pauseOverlay.classList.toggle('hidden', !isPaused);
  
  // Update button text
  document.getElementById('pause-button').textContent = isPaused ? 'RESUME' : 'PAUSE';
}

// Restart the game
function restartGame() {
  if (dropInterval) {
    clearInterval(dropInterval);
    dropInterval = null;
  }
  
  startGame();
}

// Return to main menu
function returnToMenu() {
  if (dropInterval) {
    clearInterval(dropInterval);
    dropInterval = null;
  }
  
  showScreen('menu');
}

// Handle keyboard input
function handleKeyDown(e) {
  if (gameState !== 'playing') return;
  
  switch (e.key) {
    case 'ArrowLeft':
      moveHorizontal(-1);
      break;
    case 'ArrowRight':
      moveHorizontal(1);
      break;
    case 'ArrowDown':
      moveDown();
      break;
    case 'ArrowUp':
      tryRotate();
      break;
    case ' ': // Space bar
      hardDrop();
      break;
    case 'p':
    case 'P':
      togglePause();
      break;
    default:
      break;
  }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
  // Create the TETORIS logo
  createTetorisLogo();
});