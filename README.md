# Image Labeler for YOLO

A complete solution for labeling images in YOLO format with a FastAPI backend and interactive web UI.

## Setup

1. Install dependencies:
   ```
   pip install fastapi uvicorn python-multipart
   ```

2. Place your image files in the `images` folder (will be created automatically if it doesn't exist).

## Running the service

```
uvicorn app:app --reload
```

The service will be available at http://localhost:8000

## Features

- **Web-based Interface**: Easily label images without additional software
- **YOLO Format**: All annotations saved in YOLO-compatible format
- **Class Management**: Create, edit, and manage annotation classes
- **Export Tool**: Package everything in a ready-to-use YOLO dataset
- **Status Tracking**: Mark images as done, in progress, or needing attention

## API Endpoints

### File Management
- `GET /list_files` - Returns a list of all files in the images folder
- `GET /get_file?filename={filename}` - Returns the specified file as binary data
- `POST /upload_files` - Upload multiple image files

### Annotation Management
- `GET /annotations/{image_name}` - Get annotations for a specific image
- `POST /annotations/{image_name}` - Save annotations for a specific image
- `GET /export_dataset` - Download all images and annotations as a YOLO dataset zip

### Class Management
- `GET /classes` - Get all available classes for labeling
- `POST /classes` - Add a new class (send `class_name` in request body)
- `PUT /classes/{class_index}` - Update an existing class name
- `PUT /class_instructions/{class_index}` - Update instructions for a specific class
- `DELETE /classes/{class_index}` - Delete a class by its index

### File Status Management
- `GET /file_statuses` - Get statuses for all files
- `PUT /file_status/{filename}` - Update status for a specific file

### System
- `GET /` - Redirects to the image labeler interface
- `GET /system_info` - Returns system information for debugging

## Web Interface Usage Guide

### Getting Started
1. Open your browser to http://localhost:8000
2. The interface is divided into a sidebar (left) and main view (right)

### Navigation and Image Selection
- All images appear in the left sidebar
- Click on any image to select it for labeling
- Use the status filter buttons (D, P, A) at the top to filter images by status:
  - D (Done): Completed images
  - P (In Progress): Images being worked on
  - A (Attention): Images needing review

### Image Annotation
- **Creating boxes**: Click the "Create Box" button, then click and drag on the image
- **Selecting boxes**: Click on any box to select it (turns red when selected)
- **Moving boxes**: Click and drag a selected box to move it
- **Resizing boxes**: Drag the corner handles to resize a selected box
- **Deleting boxes**: Select a box and click "Delete Selected" or use the × button in the box table
- **Changing class**: Select a box and choose a new class from its dropdown in the table

### Zoom and Pan Controls
- **Zoom**: Use the mouse wheel to zoom in/out
- **Pan**: Hold the middle mouse button and drag to pan the image
- Zoom focuses on the cursor position for precise control

### Class Management
- Add new classes with the "New class name" input and "Add" button
- Select an existing class from the dropdown to work with it
- Use "Rename" to change a class name
- Use "Delete" to remove a class (can't delete the last class)
- Add annotation instructions for each class in the "Class Instructions" text area

### Keyboard Shortcuts
- Use number keys 1-9 to quickly select the first 9 classes
- When a box is selected, pressing a number key assigns that class to the box

### File Status
- Change image status using the dropdown next to each filename:
  - D: Done
  - P: In Progress
  - A: Needs Attention

### Uploading Images
- Drag and drop images into the upload area, or click to select files
- Supports jpg, jpeg, png, gif, webp, and bmp formats

### Saving and Exporting
- Click "Save Annotations" to save the current image's annotations
- Click "Export YOLO Dataset" to download a zip file containing:
  - All images organized in YOLO format
  - All annotation files
  - A YAML configuration file for training

### System Diagnostics
- Click "Check System" to view information about the backend configuration
- Useful for troubleshooting if you encounter issues

## Tips for Efficient Labeling
- Use keyboard shortcuts (numbers 1-9) to quickly assign classes
- Mark images as "Done" when complete to keep track of progress
- Add detailed class instructions to maintain annotation consistency
- Save frequently to avoid losing work
- Use the status filters to focus on specific groups of images
