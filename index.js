// --- 1. CONFIGURATION AND UTILITIES ---
const CONFIG = {
    MAX_HISTORY_SIZE: 50,
    HIGHLIGHTER_OPACITY: 0.4,
    ERASER_OFFSET: 10,
    // Add more config settings here to make the file longer
};

// Simple utility to get mouse/touch coordinates
function getCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

// --- 2. THE MAIN WHITEBOARD CLASS (OOP Structure) ---
class Whiteboard {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // State Management
        this.currentTool = 'pen'; 
        this.currentColor = '#000000';
        this.currentLineWidth = 5;
        this.isDrawing = false; // Pen, Highlighter, Eraser
        this.isShaping = false; 
        this.isTyping = false; 

        this.startX = 0;
        this.startY = 0;
        this.selectedShape = 'rect'; 

        // History Management
        this.canvasHistory = []; 
        this.historyIndex = -1;

        // Text Tool Storage
        this.texts = []; 
        this.currentText = null; 

        this.initControls();
        this.setupCanvas();
        this.bindEvents();
    }

    // --- SETUP METHODS ---
    setupCanvas() {
        this.controlsPanel = document.getElementById('controls-panel');
        
        const controlsHeight = this.controlsPanel.offsetHeight;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - controlsHeight;
        this.canvas.style.marginTop = `${controlsHeight}px`;

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentLineWidth;
        
        if (this.historyIndex === -1) {
            this.saveState();
        }
    }

    initControls() {
        this.toolSelector = document.getElementById('toolSelector');
        this.shapeSelector = document.getElementById('shapeSelector');
        this.colorPicker = document.getElementById('colorPicker');
        this.lineWidthSlider = document.getElementById('lineWidthSlider');
        this.lineWidthDisplay = document.getElementById('lineWidthDisplay');

        // Bind control events
        this.toolSelector.addEventListener('change', (e) => this.selectTool(e.target.value));
        this.shapeSelector.addEventListener('change', (e) => this.selectShapeTool(e.target.value));
        this.colorPicker.addEventListener('input', (e) => { this.currentColor = e.target.value; });
        this.lineWidthSlider.addEventListener('input', (e) => this.updateLineWidth(e.target.value));
        
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearBoard());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveDrawing());
    }

    updateLineWidth(value) {
        this.currentLineWidth = parseInt(value, 10);
        this.lineWidthDisplay.textContent = `${this.currentLineWidth} px`;
    }

    selectTool(tool) {
        this.currentTool = tool;
        this.isShaping = false;
        this.isTyping = (tool === 'text');
        
        // UI cleanup
        this.shapeSelector.value = 'none';
        this.canvas.style.cursor = (tool === 'text') ? 'default' : 'crosshair';
    }

    selectShapeTool(shape) {
        if (shape !== 'none') {
            this.selectedShape = shape;
            this.selectTool('shape');
        } else {
            this.selectTool('pen');
        }
    }
    
    // --- DRAWING LOGIC ---

    // [script.js - CLASS Whiteboard के अंदर]

    startDrawing(e) {
        e.preventDefault();
        const { x, y } = getCoords(e, this.canvas);
        this.startX = x;
        this.startY = y;

        if (['pen', 'highlighter', 'eraser'].includes(this.currentTool)) {
            this.isDrawing = true;
            this.ctx.beginPath(); 
            this.ctx.moveTo(x, y); 
        } else if (this.currentTool === 'shape') {
            this.isShaping = true;
            // *FIX 1: कैनवास का वर्तमान डेटा एक अस्थायी वेरिएबल में सेव करें*
            this.canvasBaseImage = this.canvas.toDataURL(); 
        } else if (this.currentTool === 'text') {
            this.addTextBox(x, y);
        }
    }

    
    // [script.js - CLASS Whiteboard के अंदर]

    // [script.js - CLASS Whiteboard के अंदर]

    draw(e) {
        e.preventDefault();
        const { x, y } = getCoords(e, this.canvas);

        if (this.isDrawing) {
            // (Drawing logic remains the same)
            this.applyToolStyle();
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            this.ctx.beginPath(); 
            this.ctx.moveTo(x, y);

        } else if (this.isShaping) {
            // *FIX 2: धुंधलापन हटाने के लिए सबसे महत्वपूर्ण बदलाव*
            
            // 1. कैनवास को तुरंत साफ करें।
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // 2. पिछली सेव की गई इमेज (बेस इमेज) को लोड करें।
            const img = new Image();
            img.src = this.canvasBaseImage;
            
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                this.redrawAll(); // टेक्स्ट फिर से ड्रा करें
                
                // 3. इस बेस इमेज पर नया प्रीव्यू ड्रा करें।
                this.drawFinalShape(this.startX, this.startY, x, y, true);
            };

        }
    }

    stopDrawing(e) {
        e.preventDefault();
        const { x, y } = getCoords(e, this.canvas);

        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveState(); 
            this.ctx.globalAlpha = 1.0; 
        } else if (this.isShaping) {
            this.isShaping = false;
            this.restoreState(true);
            this.drawFinalShape(this.startX, this.startY, x, y);
            this.saveState();
        }
    }

    // --- TEXT TOOL LOGIC ---

    addTextBox(x, y) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'text-input-overlay';
        input.style.position = 'absolute';
        input.style.left = `${x}px`;
        input.style.top = `${y}px`;
        input.style.color = this.currentColor;
        input.style.fontSize = `${this.currentLineWidth * 2}px`;
        document.body.appendChild(input);

        input.focus();
        
        input.addEventListener('blur', () => {
            if (input.value) {
                this.texts.push({
                    text: input.value,
                    x: x,
                    y: y + this.currentLineWidth * 2,
                    font: `${this.currentLineWidth * 2}px Arial`,
                    color: this.currentColor,
                });
                this.redrawAll(); 
                this.saveState();
            }
            document.body.removeChild(input);
        });
    }

    redrawAll() {
        // Redraws only the image state from history and then all texts
        const state = this.canvasHistory[this.historyIndex];
        const img = new Image();
        img.src = state.imageData;
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            
            this.texts.forEach(t => {
                this.ctx.font = t.font;
                this.ctx.fillStyle = t.color;
                this.ctx.fillText(t.text, t.x, t.y);
            });
        };
    }
    
    // --- STYLING AND ACTIONS ---

    applyToolStyle() {
        this.ctx.globalAlpha = 1.0;
        this.ctx.lineWidth = this.currentLineWidth;

        if (this.currentTool === 'pen') {
            this.ctx.strokeStyle = this.currentColor;
        } else if (this.currentTool === 'highlighter') {
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.currentLineWidth * 3; 
            this.ctx.globalAlpha = CONFIG.HIGHLIGHTER_OPACITY;
        } else if (this.currentTool === 'eraser') {
            // Hand Set Eraser Logic (Set stroke color to background)
            this.ctx.strokeStyle = '#f0f0f5'; 
            this.ctx.lineWidth = this.currentLineWidth + CONFIG.ERASER_OFFSET; 
        }
    }

    clearBoard() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.texts = []; 
        this.saveState();
    }

    saveDrawing() {
        const imageURL = this.canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imageURL;
        link.download = 'premium_whiteboard.png';
        link.click();
    }
    
    // --- HISTORY METHODS ---

    
    // [script.js - CLASS Whiteboard के अंदर]

    saveState() {
        if (this.historyIndex < this.canvasHistory.length - 1) {
            this.canvasHistory = this.canvasHistory.slice(0, this.historyIndex + 1);
        }
        
        // एक वेरिएबल में कैनवास का अंतिम PNG डेटा स्टोर करें
        const currentImageData = this.canvas.toDataURL(); 

        this.canvasHistory.push({
            imageData: currentImageData, // सिर्फ PNG डेटा
            textsData: JSON.parse(JSON.stringify(this.texts))
        });
        this.historyIndex++;
        
        // ... (बाकी History Logic remains the same)
        
        this.updateUndoRedoButtons();
    }

    // [script.js - CLASS Whiteboard के अंदर]

    restoreState(isRedraw = false) {
        if (this.historyIndex >= 0 && this.historyIndex < this.canvasHistory.length) {
            const state = this.canvasHistory[this.historyIndex];
            
            // Restore Texts
            this.texts = JSON.parse(JSON.stringify(state.textsData));
            
            // Restore Image
            const img = new Image();
            img.src = state.imageData;
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                // *FIX 1: Draw the base image*
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height); 
                this.redrawAll(); 
                if (!isRedraw) this.updateUndoRedoButtons();
            };
        }
    }
    
    // यह फ़ंक्शन सिर्फ़ टेक्स्ट को फिर से ड्रा करता है (जैसा पहले था)
    redrawAll() {
        // Redraws all stored texts over the existing canvas content
        this.texts.forEach(t => {
            this.ctx.font = t.font;
            this.ctx.fillStyle = t.color;
            this.ctx.fillText(t.text, t.x, t.y);
        });
    }

    updateUndoRedoButtons() {
        document.getElementById('undoBtn').disabled = this.historyIndex <= 0;
        document.getElementById('redoBtn').disabled = this.historyIndex >= this.canvasHistory.length - 1;
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState();
        }
    }

    redo() {
        if (this.historyIndex < this.canvasHistory.length - 1) {
            this.historyIndex++;
            this.restoreState();
        }
    }

    // --- SHAPE DRAWING ---
    drawFinalShape(x1, y1, x2, y2, isPreview = false) {
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentLineWidth;
        this.ctx.globalAlpha = isPreview ? 0.5 : 1.0; 
        this.ctx.fillStyle = this.currentColor + (isPreview ? '22' : '33');
        
        const width = x2 - x1;
        const height = y2 - y1;
        const absWidth = Math.abs(width);
        const absHeight = Math.abs(height);

        this.ctx.beginPath();
        
        switch (this.selectedShape) {
            case 'rect': 
                this.ctx.rect(x1, y1, width, height);
                break;
                
            case 'circle': { 
                const centerX = x1 + width / 2;
                const centerY = y1 + height / 2;
                const radiusX = absWidth / 2;
                const radiusY = absHeight / 2;
                this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                break;
            }
            
            case 'line': 
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke(); 
                return;
                
            // ... (All other 17 shapes would have similar complex drawing logic here)
            default:
                this.ctx.rect(x1, y1, width, height); 
                break;
        }
        
        // Fill and Stroke the shape
        if (this.selectedShape !== 'line') {
            this.ctx.fill();
        }
        this.ctx.stroke();
    }
    
    // --- EVENT BINDING ---
    bindEvents() {
        window.addEventListener('resize', () => this.setupCanvas());

        // Mouse Events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', (e) => this.stopDrawing(e));
        this.canvas.addEventListener('mouseout', (e) => {
            if (this.isDrawing || this.isShaping) this.stopDrawing(e);
        });

        // Touch Events (Mobile)
        this.canvas.addEventListener('touchstart', (e) => this.startDrawing(e));
        this.canvas.addEventListener('touchmove', (e) => this.draw(e));
        this.canvas.addEventListener('touchend', (e) => this.stopDrawing(e));
    }
}

// --- 3. INITIALIZE THE WHITEBOARD ---
const whiteboardApp = new Whiteboard('whiteboard');