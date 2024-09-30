# Trianno

This project is a Vue 3 application that provides an annotation tool for labeling images with a brush and fill tool. It also displays ground truth (GT) data from an existing dataset for easier annotation. Users can switch annotation labels with the 'x' key.

## Features

- **Brush Tool**: Annotate images using a brush with adjustable size.
- **Fill Tool**: Quickly fill regions with the current annotation label.
- **Label Switching**: Right-click to cycle between Foreground, Background, and Unknown labels.
- **Ground Truth Display**: View the existing dataset's ground truth alongside the images to assist with annotations.

## Project Setup

### Client and Server

1. Install dependencies for both the client (Vue.js) and server (Node.js):
   ```sh
   cd backend
   node server.js
   ```

2. Start the Vue.js development server:
   ```sh
   npm run dev
   ```

3. Open the application in your browser at http://localhost:XXXX.

## Usage

1. Start both the client and server as described above.
2. Use the brush or fill tool to annotate images.
   - **Brush**: Left-click and drag to draw.
   - **Fill**: Select the fill tool and click to flood-fill a region.
3. The current ground truth data is displayed alongside the images for reference.
4. Press **s** to save your work.
5. Press **z** to undo the last action.
6  Press **x** to switch between Brush and Fill.
7. Press **q** to go to the previous image and **w** to go to the next image.
