<template>
  <div id="app">
    <!-- Image and Button Container -->
    <div class="layout">
      <div class="canvas-container" v-if="imageLoaded">
        <!-- Trimap Reference Image -->
        <div class="reference-image">
          <h3>Trimap</h3>
          <img :src="trimapUrl" class="reference-img" />
        </div>

        <!-- Merged Image for Annotation -->
        <div class="main-image">
          <h3>Merged</h3>
          <canvas
            ref="canvas"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @wheel="adjustBrushSize"
            :style="{ cursor: `url(${brushCursor}) ${brushSize / 2} ${brushSize / 2}, auto` }"
          ></canvas>
        </div>

        <!-- Alpha Reference Image -->
        <div class="reference-image">
          <h3>Alpha</h3>
          <img :src="alphaUrl" class="reference-img" />
        </div>
      </div>

      <!-- Buttons below the images -->
      <div class="controls">
        <div>
          <button @click="prevImage">Previous</button>
          <button @click="nextImage">Next</button>
          <!-- Display image name -->
          <span>{{ currentIndex + 1 }} / {{ files.merged.length }}</span>
        </div>
        <div v-if="imageLoaded">
          <div>
            <label>Brush Size:</label>
            <input type="range" v-model="brushSize" min="1" max="100" />
            <span>{{ brushSize }}px</span>
          </div>
          <div>
            <label>Annotation Type:</label>
            <select v-model="currentLabel">
              <option :value="255">Foreground (255)</option>
              <option :value="0">Background (0)</option>
              <option :value="128">Unknown (128)</option>
            </select>
          </div>
          <button @click="saveTrimap">Save Annotation</button>
          <button @click="undo">Undo</button>
          <div>
            <label>Tool:</label>
            <select v-model="currentTool">
              <option value="brush">Brush</option>
              <option value="fill">Fill</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script>
export default {
  data() {
    return {
      files: {
        trimaps: [],
        merged: [],
        alphaCopy: [],
      },
      annotationCanvas: null,  // Annotation layer canvas
      annotationContext: null,  // Annotation layer context
      markedCanvas: null,       // Marked layer canvas
      markedContext: null,      // Marked layer context
      selectedFile: '',
      currentIndex: 0, // Current selected image index
      brushSize: 50,
      currentLabel: 255,
      imageLoaded: false,
      drawing: false,
      img: null,
      canvasContext: null,
      trimapUrl: '',
      alphaUrl: '',
      brushCursor: null,
      lastPosX: null, // Last mouse position
      lastPosY: null,
      history: [],  // Used to store the history state before drawing
      maxHistorySize: 10,  // Limit the size of the history stack
      offscreenCanvas: null,
      offscreenContext: null,
      updateCanvasTimeout: null,
      currentTool: 'brush', // Default to brush tool
    };
  },
  created() {
    this.getFiles();
    window.addEventListener('keydown', this.handleKeydown);
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.handleKeydown);
  },
  mounted() {
    // Disable right-click menu
    window.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  },
  methods: {
    handleKeydown(event) {
      switch (event.key) {
        case 'z':
          this.undo();
          break;
        case 'x':
          this.currentTool = this.currentTool === 'brush' ? 'fill' : 'brush';
          this.updateBrushCursor();
          break;
        case 's':
          this.saveTrimap();
          break;
        case 'q':
          this.prevImage();
          break;
        case 'w':
          this.nextImage();
          break;
      }
    },
    undo() {
      if (this.history.length > 0) {
        const lastState = this.history.pop();
        this.annotationContext.putImageData(lastState.annotation, 0, 0);
        this.markedContext.putImageData(lastState.marked, 0, 0);
        this.updateCanvas();
      } else {
        console.log("No actions to undo");
      }
    },
    // Get the file list and load the first image by default
    getFiles() {
      fetch('http://localhost:3000/files')
        .then((response) => response.json())
        .then((data) => {
          this.files = data;
          if (this.files.merged.length > 0) {
            this.loadImages(0); // Load the first image by default
          }
        })
        .catch((error) => console.error('Error fetching files:', error));
    },
    // Load the image at the specified index
    loadImages(index) {
      if (!this.files.merged[index]) return;
      this.selectedFile = this.files.merged[index];
      this.currentIndex = index;
      this.loadImage('merged', (url) => {
        this.img = new Image();
        this.img.onload = () => {
          this.originalWidth = this.img.naturalWidth;
          this.originalHeight = this.img.naturalHeight;
          this.initializeCanvases();
          this.resetTool();
        };
        this.img.src = url;
        this.imageLoaded = true;
      });
      this.loadImage('trimaps', (url) => (this.trimapUrl = url));
      this.loadImage('alpha_copy', (url) => (this.alphaUrl = url));
    },
    // Load image resources
    loadImage(folder, callback) {
      fetch(`http://localhost:3000/file/${folder}/${this.selectedFile}`)
        .then((response) => response.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          callback(url);
        })
        .catch((error) => console.error('Error loading image:', error));
    },
    // Load the previous image
    prevImage() {
      const prevIndex = (this.currentIndex - 1 + this.files.merged.length) % this.files.merged.length;
      this.loadImages(prevIndex);
      this.resetTool();
    },
    // Load the next image
    nextImage() {
      const nextIndex = (this.currentIndex + 1) % this.files.merged.length;
      this.loadImages(nextIndex);
      this.resetTool();
    },
    // Initialize canvases
    initializeCanvases() {
      const canvas = this.$refs.canvas;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const scaleFactor = Math.min(window.innerWidth * 0.5 / this.img.width, window.innerHeight * 0.8 / this.img.height);
      canvas.width = this.img.width * scaleFactor;
      canvas.height = this.img.height * scaleFactor;
      
      // Draw the original image
      context.drawImage(this.img, 0, 0, canvas.width, canvas.height);
      
      // Initialize annotation layer
      this.annotationCanvas = document.createElement('canvas');
      this.annotationCanvas.width = canvas.width;
      this.annotationCanvas.height = canvas.height;
      this.annotationContext = this.annotationCanvas.getContext('2d', { willReadFrequently: true });
      
      // Initialize the annotation layer with a value of 128 (gray)
      const initialData = this.annotationContext.createImageData(this.annotationCanvas.width, this.annotationCanvas.height);
      for (let i = 0; i < initialData.data.length; i += 4) {
        initialData.data[i] = 128;     // R
        initialData.data[i+1] = 128;   // G
        initialData.data[i+2] = 128;   // B
        initialData.data[i+3] = 255;   // A (fully opaque)
      }
      this.annotationContext.putImageData(initialData, 0, 0);

      // Initialize marked layer
      this.markedCanvas = document.createElement('canvas');
      this.markedCanvas.width = canvas.width;
      this.markedCanvas.height = canvas.height;
      this.markedContext = this.markedCanvas.getContext('2d', { willReadFrequently: true });
      this.markedContext.fillStyle = 'rgba(0, 0, 0, 0)';
      this.markedContext.fillRect(0, 0, this.markedCanvas.width, this.markedCanvas.height);

      this.canvasContext = context;
      this.updateBrushCursor();

      // Create offscreen canvas
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = canvas.width;
      this.offscreenCanvas.height = canvas.height;
      this.offscreenContext = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    },
    // Start drawing
    startDrawing(event) {
      if (event.button === 2) {  // Right-click
        // Switch label logic
        if (this.currentLabel === 255) {
          this.currentLabel = 0;
        } else if (this.currentLabel === 0) {
          this.currentLabel = 128;
        } else {
          this.currentLabel = 255;
        }
        this.updateBrushCursor();
        return;
      }

      // Left-click
      if (this.currentTool === 'fill') {
        this.fill(event);
      } else {
        // Original brush logic
        this.saveState();
        this.drawing = true;
        this.lastPosX = null;
        this.lastPosY = null;
        this.draw(event);
      }
    },

    saveState() {
      const annotationState = this.annotationContext.getImageData(0, 0, this.annotationCanvas.width, this.annotationCanvas.height);
      const markedState = this.markedContext.getImageData(0, 0, this.markedCanvas.width, this.markedCanvas.height);
      
      this.history.push({ annotation: annotationState, marked: markedState });

      // Limit the size of the history stack
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }
    },

    stopDrawing() {
      this.drawing = false;
    },
    // Solve the problem of discontinuous points by drawing lines to connect points
    draw(event) {
      if (!this.drawing) return;
      const rect = this.$refs.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const radius = this.brushSize / 2;

      if (this.lastPosX === null || this.lastPosY === null) {
        this.drawCircle(x, y, radius);
      } else {
        // Use Bresenham's algorithm to draw lines
        this.drawLine(this.lastPosX, this.lastPosY, x, y, radius);
      }

      this.lastPosX = x;
      this.lastPosY = y;

      // Use throttling to reduce the frequency of updateCanvas calls
      if (!this.updateCanvasTimeout) {
        this.updateCanvasTimeout = setTimeout(() => {
          this.updateCanvas();
          this.updateCanvasTimeout = null;
        }, 20); // Update at most once every 20 milliseconds
      }
    },

    drawCircle(x, y, radius) {
      this.offscreenContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
      this.offscreenContext.beginPath();
      this.offscreenContext.arc(x, y, radius, 0, Math.PI * 2);
      this.offscreenContext.fillStyle = `rgb(${this.currentLabel}, ${this.currentLabel}, ${this.currentLabel})`;
      this.offscreenContext.fill();

      // Use globalCompositeOperation to achieve smooth blending
      this.annotationContext.globalCompositeOperation = 'source-over';
      this.annotationContext.drawImage(this.offscreenCanvas, 0, 0);
      this.markedContext.globalCompositeOperation = 'source-over';
      this.markedContext.drawImage(this.offscreenCanvas, 0, 0);
    },

    drawLine(x0, y0, x1, y1, radius) {
      this.offscreenContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
      this.offscreenContext.beginPath();
      this.offscreenContext.moveTo(x0, y0);
      this.offscreenContext.lineTo(x1, y1);
      this.offscreenContext.lineWidth = radius * 2;
      this.offscreenContext.lineCap = 'round';
      this.offscreenContext.lineJoin = 'round';  // Add this line
      this.offscreenContext.strokeStyle = `rgb(${this.currentLabel}, ${this.currentLabel}, ${this.currentLabel})`;
      this.offscreenContext.stroke();

      // Use globalCompositeOperation to achieve smooth blending
      this.annotationContext.globalCompositeOperation = 'source-over';
      this.annotationContext.drawImage(this.offscreenCanvas, 0, 0);
      this.markedContext.globalCompositeOperation = 'source-over';
      this.markedContext.drawImage(this.offscreenCanvas, 0, 0);
    },

    // Update the main canvas
    updateCanvas() {
      const canvas = this.$refs.canvas;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(this.img, 0, 0, canvas.width, canvas.height);
      
      const annotationData = this.annotationContext.getImageData(0, 0, canvas.width, canvas.height);
      const markedData = this.markedContext.getImageData(0, 0, canvas.width, canvas.height);
      const originalData = context.getImageData(0, 0, canvas.width, canvas.height);
      const mergedData = context.createImageData(canvas.width, canvas.height);

      for (let i = 0; i < mergedData.data.length; i += 4) {
        if (markedData.data[i + 3] !== 0) {
          mergedData.data[i] = annotationData.data[i];
          mergedData.data[i + 1] = annotationData.data[i + 1];
          mergedData.data[i + 2] = annotationData.data[i + 2];
          mergedData.data[i + 3] = 255;
        } else {
          mergedData.data[i] = originalData.data[i];
          mergedData.data[i + 1] = originalData.data[i + 1];
          mergedData.data[i + 2] = originalData.data[i + 2];
          mergedData.data[i + 3] = originalData.data[i + 3];
        }
      }

      context.putImageData(mergedData, 0, 0);
    },
    adjustBrushSize(event) {
      event.preventDefault();
      if (event.deltaY < 0) {
        this.brushSize = Math.min(100, this.brushSize + 1);
      } else {
        this.brushSize = Math.max(1, this.brushSize - 1);
      }
      this.updateBrushCursor();
    },
    // Save annotation
    saveTrimap() {
      // Create a temporary canvas with the same size as the original image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.img.naturalWidth;
      tempCanvas.height = this.img.naturalHeight;
      const tempCtx = tempCanvas.getContext('2d');

      // Draw the current annotation data onto the temporary canvas and scale it
      tempCtx.drawImage(this.annotationCanvas, 0, 0, this.annotationCanvas.width, this.annotationCanvas.height, 
                        0, 0, this.img.naturalWidth, this.img.naturalHeight);

      // Save the temporary canvas as an image
      tempCanvas.toBlob((blob) => {
        const formData = new FormData();
        formData.append('annotatedImage', blob, this.selectedFile);

        fetch('http://localhost:3000/save', {
          method: 'POST',
          body: formData,
        })
        .then((response) => response.json())
        .then((data) => {
          console.log('Save successful:', data.message);
        })
        .catch((error) => {
          console.error('Error saving file:', error);
        });
      }, 'image/png');
    },
    updateBrushCursor() {
      const size = this.brushSize;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = size;
      canvas.height = size;

      // Set brush color based on currentLabel
      let color;
      if (this.currentLabel === 255) {
        color = 'rgb(255, 255, 255)';  // White foreground
      } else if (this.currentLabel === 0) {
        color = 'rgb(0, 0, 0)';        // Black background
      } else {
        color = 'rgb(128, 128, 128)';  // Gray unknown area
      }

      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      this.brushCursor = canvas.toDataURL();
    },
    fill(event) {
      // Save the current state to the history stack
      this.saveState();

      const rect = this.$refs.canvas.getBoundingClientRect();
      const x = Math.floor(event.clientX - rect.left);
      const y = Math.floor(event.clientY - rect.top);

      const stack = [[x, y]];
      const width = this.annotationCanvas.width;
      const height = this.annotationCanvas.height;

      const markedData = this.markedContext.getImageData(0, 0, width, height);
      const annoData = this.annotationContext.getImageData(0, 0, width, height);

      const fillColor = this.currentLabel;

      while (stack.length > 0) {
        const [currentX, currentY] = stack.pop();
        const index = (currentY * width + currentX) * 4;

        // Check if it is already annotated or out of bounds
        if (currentX < 0 || currentX >= width || currentY < 0 || currentY >= height || 
            markedData.data[index + 3] !== 0) {
          continue;
        }

        // Mark this point
        markedData.data[index] = 255;
        markedData.data[index + 1] = 255;
        markedData.data[index + 2] = 255;
        markedData.data[index + 3] = 255;

        // Fill color on the annotation layer
        annoData.data[index] = fillColor;
        annoData.data[index + 1] = fillColor;
        annoData.data[index + 2] = fillColor;
        annoData.data[index + 3] = 255;

        // Add adjacent points to the stack
        stack.push([currentX + 1, currentY]);
        stack.push([currentX - 1, currentY]);
        stack.push([currentX, currentY + 1]);
        stack.push([currentX, currentY - 1]);
      }

      // Update marked layer and annotation layer
      this.markedContext.putImageData(markedData, 0, 0);
      this.annotationContext.putImageData(annoData, 0, 0);

      // Update the main canvas
      this.updateCanvas();
    },
    resetTool() {
      this.currentTool = 'brush';
      this.updateBrushCursor();
    },
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  text-align: center;
}

.layout {
  display: flex;
  flex-direction: column; /* Change to vertical layout */
  justify-content: center;
  align-items: center;
}

.canvas-container {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px; /* Add some space between images and buttons */
}

.reference-image, .main-image {
  text-align: center;
}

.reference-img {
  width: 200px;
  height: auto;
  margin-top: 10px;
}

canvas {
  border: 1px solid #000;
}

.controls {
  position: fixed;
  bottom: 10px;
  left: 0;
  right: 0;
  text-align: center;
  display: flex;
  justify-content: center; /* Change to center alignment */
  align-items: center; /* Vertical center alignment */
  gap: 10px;
  background-color: rgba(255, 255, 255, 0.8); /* Add semi-transparent background */
  padding: 10px; /* Add padding */
}

.controls > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Add styles for image name */
.controls span {
  font-weight: bold;
  margin: 0 10px;
}
</style>