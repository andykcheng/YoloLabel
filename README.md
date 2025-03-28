# Image Files API with YOLO Labeler

A FastAPI service to list, retrieve, and label image files for YOLO training.

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Place your image files in the `images` folder. The folder will be created automatically if it doesn't exist.

## Running the service

```
uvicorn app:app --reload
```

The service will be available at http://localhost:8000

## Features

- **Image API**: Access raw images programmatically
- **Image Labeler**: Web-based interface for creating YOLO format annotations
- **YOLO Export**: Download annotation files compatible with YOLO training

## API Endpoints

- `/list_files` - Returns a list of all files in the images folder
- `/get_file?filename=example.jpg` - Returns the specified file as binary data

## Image Labeler

Access the YOLO image labeler by visiting the root URL in your browser:
```
http://localhost:8000/
```

### Labeling Instructions

1. Select an image from the sidebar
2. Click "Create Box" to start drawing bounding boxes
3. Click and drag on the image to create a box
4. Select a class for the box from the dropdown
5. Use "Delete Selected" to remove a box
6. Click "Save Annotations" to download the YOLO format annotation file

## API Documentation

Once the server is running, you can access the automatic API documentation at:
- http://localhost:8000/docs (Swagger UI)
- http://localhost:8000/redoc (ReDoc)
