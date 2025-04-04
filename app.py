from fastapi import FastAPI, HTTPException, Body, File, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import io
import zipfile
import shutil
from typing import List, Dict, Optional
import yolo_predict
from PIL import Image
from datetime import datetime

app = FastAPI(title="Image Files API")

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the path to the images folder
IMAGES_FOLDER = os.path.join(os.getcwd(), "images")
# Define the path to original images folder
ORIGINAL_IMAGES_FOLDER = os.path.join(os.getcwd(), "original_images")
# Define the path to classes file
CLASSES_FILE = os.path.join(os.getcwd(), "classes.json")
# Define the path to annotations folder
ANNOTATIONS_FOLDER = os.path.join(os.getcwd(), "annotations")
# Define the path to file statuses JSON
FILE_STATUS_PATH = os.path.join(os.getcwd(), "file_statuses.json")

# Make sure the images folder exists
os.makedirs(IMAGES_FOLDER, exist_ok=True)
# Make sure the original images folder exists
os.makedirs(ORIGINAL_IMAGES_FOLDER, exist_ok=True)
# Make sure the annotations folder exists
os.makedirs(ANNOTATIONS_FOLDER, exist_ok=True)

# Mount static files directory
app.mount("/static", StaticFiles(directory="static_pages"), name="static")

# Helper function to load classes from JSON file
def load_classes():
    if not os.path.exists(CLASSES_FILE):
        # Create default classes file if it doesn't exist
        with open(CLASSES_FILE, 'w') as f:
            json.dump([{"name": "Class 0", "instructions": ""}], f)
        return [{"name": "Class 0", "instructions": ""}]
    
    with open(CLASSES_FILE, 'r') as f:
        classes = json.load(f)
        
        # Convert simple string classes to objects for backward compatibility
        for i, c in enumerate(classes):
            if isinstance(c, str):
                classes[i] = {"name": c, "instructions": ""}
        
        return classes

# Helper function to save classes to JSON file
def save_classes(classes):
    with open(CLASSES_FILE, 'w') as f:
        json.dump(classes, f)

# Helper function to load file statuses
def load_file_statuses():
    if not os.path.exists(FILE_STATUS_PATH):
        return {}
    
    try:
        with open(FILE_STATUS_PATH, 'r') as f:
            return json.load(f)
    except:
        return {}

# Helper function to save file statuses
def save_file_statuses(statuses):
    with open(FILE_STATUS_PATH, 'w') as f:
        json.dump(statuses, f)

@app.get("/")
async def root():
    """Redirect root to the image labeler interface"""
    return FileResponse("static_pages/index.html")

@app.get("/list_files", response_model=List[str])
async def list_files():
    """Return a list of files inside the images folder."""
    try:
        # Get a list of all files in the images folder
        files = os.listdir(IMAGES_FOLDER)
        # Filter out directories, only include files
        files = [f for f in files if os.path.isfile(os.path.join(IMAGES_FOLDER, f))]
        print(f"Found {len(files)} files in {IMAGES_FOLDER}")
        return files
    except Exception as e:
        # Log the error details
        print(f"Error listing files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_file")
async def get_file(filename: str):
    """Return a file as binary given a parameter of the file name."""
    file_path = os.path.join(IMAGES_FOLDER, filename)
    
    print(f"Attempting to serve file: {file_path}")
    
    # Check if the file exists
    if not os.path.isfile(file_path):
        print(f"File not found: {file_path}")
        raise HTTPException(status_code=404, detail=f"File {filename} not found")
    
    try:
        # Get file size for logging
        file_size = os.path.getsize(file_path)
        print(f"Serving file: {file_path} ({file_size} bytes)")
        
        # Return the file as binary with appropriate headers
        return FileResponse(
            file_path,
            headers={
                "Cache-Control": "max-age=3600",  # Allow caching for 1 hour
                "Accept-Ranges": "bytes"
            }
        )
    except Exception as e:
        print(f"Error serving file {file_path}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Class management endpoints
@app.get("/classes", response_model=List[Dict])
async def get_classes():
    """Return all available classes for labeling."""
    try:
        classes = load_classes()
        return classes
    except Exception as e:
        print(f"Error loading classes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/classes", response_model=List[Dict])
async def add_class(class_name: str = Body(..., embed=True)):
    """Add a new class to the list."""
    try:
        classes = load_classes()
        
        # Check if name already exists
        existing_names = [c["name"] for c in classes if isinstance(c, dict) and "name" in c]
        if class_name in existing_names:
            raise HTTPException(status_code=400, detail="Class already exists")
        
        # Add new class as an object with name and empty instructions
        classes.append({"name": class_name, "instructions": ""})
        save_classes(classes)
        return classes
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding class: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/classes/{class_index}", response_model=List[Dict])
async def update_class(class_index: int, class_name: str = Body(..., embed=True)):
    """Update an existing class name."""
    try:
        classes = load_classes()
        if class_index < 0 or class_index >= len(classes):
            raise HTTPException(status_code=404, detail="Class index not found")
        
        # Update name while preserving instructions
        if isinstance(classes[class_index], dict):
            classes[class_index]["name"] = class_name
        else:
            # Convert string to object if needed
            classes[class_index] = {"name": class_name, "instructions": ""}
            
        save_classes(classes)
        return classes
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating class: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/class_instructions/{class_index}", response_model=Dict)
async def update_class_instructions(class_index: int, data: Dict = Body(...)):
    """Update instructions for a specific class."""
    try:
        classes = load_classes()
        if class_index < 0 or class_index >= len(classes):
            raise HTTPException(status_code=404, detail="Class index not found")
        
        instructions = data.get("instructions", "")
        
        # Update instructions while preserving name
        if isinstance(classes[class_index], dict):
            classes[class_index]["instructions"] = instructions
        else:
            # Convert string to object if needed
            classes[class_index] = {"name": classes[class_index], "instructions": instructions}
            
        save_classes(classes)
        return {"success": True, "message": f"Instructions updated for class {class_index}"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating class instructions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/classes/{class_index}", response_model=List[Dict])
async def delete_class(class_index: int):
    """Delete a class by its index."""
    try:
        classes = load_classes()
        if class_index < 0 or class_index >= len(classes):
            raise HTTPException(status_code=404, detail="Class index not found")
        
        # Prevent deleting the last class
        if len(classes) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last class")
        
        classes.pop(class_index)
        save_classes(classes)
        return classes
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting class: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Annotation management endpoints
@app.get("/annotations/{image_name}")
async def get_annotation(image_name: str):
    """Get annotations for a specific image."""
    try:
        # Create annotation filename (replace image extension with .txt)
        annotation_file = os.path.splitext(image_name)[0] + ".txt"
        annotation_path = os.path.join(ANNOTATIONS_FOLDER, annotation_file)
        
        # Check if the annotation file exists
        if not os.path.exists(annotation_path):
            return {"boxes": []}
        
        # Read the annotation file content
        with open(annotation_path, 'r') as f:
            lines = f.read().strip().split('\n')
        
        # Parse YOLO format annotations to box format
        boxes = []
        # Get the image dimensions to convert normalized coordinates
        image_path = os.path.join(IMAGES_FOLDER, image_name)
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail=f"Image {image_name} not found")
        
        for line in lines:
            if not line.strip():  # Skip empty lines
                continue
                
            parts = line.split()
            if len(parts) != 5:  # Standard YOLO format has 5 values
                continue
                
            class_id = int(parts[0])
            x_center = float(parts[1])
            y_center = float(parts[2])
            width = float(parts[3])
            height = float(parts[4])
            
            # Convert normalized coordinates to pixel coordinates
            # This will be done on the client side since we have the image dimensions there
            boxes.append({
                "class": class_id,
                "x_center": x_center,
                "y_center": y_center,
                "width": width,
                "height": height
            })
            
        return {"boxes": boxes}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error loading annotation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/annotations/{image_name}")
async def save_annotation(image_name: str, data: Dict = Body(...)):
    """Save annotations for a specific image."""
    try:
        boxes = data.get("boxes", [])
        
        # Create annotation filename (replace image extension with .txt)
        annotation_file = os.path.splitext(image_name)[0] + ".txt"
        annotation_path = os.path.join(ANNOTATIONS_FOLDER, annotation_file)
        
        # Convert to YOLO format
        lines = []
        for box in boxes:
            class_id = box.get("class", 0)
            x_center = box.get("x_center", 0)
            y_center = box.get("y_center", 0)
            width = box.get("width", 0)
            height = box.get("height", 0)
            
            line = f"{class_id} {x_center} {y_center} {width} {height}"
            lines.append(line)
        
        # Write to file
        with open(annotation_path, 'w') as f:
            f.write('\n'.join(lines))
        
        return {"success": True, "message": f"Annotations saved for {image_name}"}
    except Exception as e:
        print(f"Error saving annotation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/export_dataset")
async def export_dataset():
    """Export all images and annotations as a YOLO dataset zip file."""
    try:
        # Create temp directory for organizing the dataset
        temp_dir = os.path.join(os.getcwd(), "temp_dataset")
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        
        # Create necessary subdirectories
        images_dir = os.path.join(temp_dir, "images")
        labels_dir = os.path.join(temp_dir, "labels")
        os.makedirs(images_dir, exist_ok=True)
        os.makedirs(labels_dir, exist_ok=True)
        
        # Get list of images
        images = [f for f in os.listdir(IMAGES_FOLDER) 
                  if os.path.isfile(os.path.join(IMAGES_FOLDER, f)) and 
                  f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.gif'))]
        
        # Copy images and their annotations to the temp directory
        for image in images:
            # Copy image
            src_image = os.path.join(IMAGES_FOLDER, image)
            dst_image = os.path.join(images_dir, image)
            shutil.copy2(src_image, dst_image)
            
            # Copy annotation if it exists
            annotation_file = os.path.splitext(image)[0] + ".txt"
            src_annotation = os.path.join(ANNOTATIONS_FOLDER, annotation_file)
            if os.path.exists(src_annotation):
                dst_annotation = os.path.join(labels_dir, annotation_file)
                shutil.copy2(src_annotation, dst_annotation)
        
        # Create a yaml configuration file for YOLO
        class_list = [c["name"] for c in load_classes()]
        yaml_content = f"""# YOLO dataset configuration
path: ./  # Path relative to the training script
train: images  # Train images folder
val: images  # Validation images folder (using same as train for simplicity)

# Classes
nc: {len(class_list)}  # Number of classes
names: {json.dumps(class_list)}  # Class names
"""
        with open(os.path.join(temp_dir, "dataset.yaml"), 'w') as f:
            f.write(yaml_content)
        
        # Create a zip file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add all files from the temp directory to the zip
            for root, _, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # Calculate the arcname (path within the zip file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zip_file.write(file_path, arcname)
        
        # Clean up the temp directory
        shutil.rmtree(temp_dir)
        
        # Reset the buffer position
        zip_buffer.seek(0)
        
        # Return the zip file for download
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=yolo_dataset.zip"}
        )
    except Exception as e:
        print(f"Error exporting dataset: {str(e)}")
        # Clean up temp directory if it exists
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/system_info")
async def system_info():
    """Return system information for debugging."""
    try:
        # Check if the IMAGES_FOLDER exists
        images_folder_exists = os.path.exists(IMAGES_FOLDER)
        
        # Get the absolute path
        abs_images_folder = os.path.abspath(IMAGES_FOLDER)
        
        # List files in the images folder if it exists
        image_files = []
        if images_folder_exists:
            try:
                all_files = os.listdir(IMAGES_FOLDER)
                image_files = [f for f in all_files if os.path.isfile(os.path.join(IMAGES_FOLDER, f)) and 
                               f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'))]
            except Exception as e:
                image_files = [f"Error listing files: {str(e)}"]
        
        # Get current working directory
        cwd = os.getcwd()
        
        return {
            "cwd": cwd,
            "images_folder": IMAGES_FOLDER,
            "abs_images_folder": abs_images_folder,
            "images_folder_exists": images_folder_exists,
            "image_count": len(image_files) if isinstance(image_files, list) else -1,
            "image_files": image_files[:20],  # Limit to first 20 to avoid too much data
            "annotations_folder": ANNOTATIONS_FOLDER,
            "annotations_folder_exists": os.path.exists(ANNOTATIONS_FOLDER)
        }
    except Exception as e:
        print(f"Error getting system info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload_files")
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload multiple image files to the images folder."""
    try:
        # Track statistics
        uploaded_count = 0
        skipped_count = 0
        uploaded_files = []
        skipped_files = []

        # Ensure original_images folder exists
        os.makedirs(ORIGINAL_IMAGES_FOLDER, exist_ok=True)
        # Ensure images folder exists
        os.makedirs(IMAGES_FOLDER, exist_ok=True)

        # Process each uploaded file
        for file in files:
            # Check if it's an image file by content type
            content_type = file.content_type
            if not content_type or not content_type.startswith('image/'):
                skipped_files.append(f"{file.filename} (not an image)")
                skipped_count += 1
                continue

            # Check file extension as a secondary validation
            filename = file.filename
            valid_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
            if not filename.lower().endswith(valid_extensions):
                skipped_files.append(f"{filename} (invalid extension)")
                skipped_count += 1
                continue

            # Read the file contents
            contents = await file.read()
            
            # Save the file to the original_images folder
            original_file_path = os.path.join(ORIGINAL_IMAGES_FOLDER, filename)
            with open(original_file_path, 'wb') as f:
                f.write(contents)

            # Open the image and resize it to 1280x720
            try:
                with Image.open(original_file_path) as img:
                    # Calculate cropping box to center the image
                    width, height = img.size
                    target_width, target_height = 1280, 720

                    if width / height > target_width / target_height:
                        # Image is too wide, trim the sides
                        new_width = int(height * target_width / target_height)
                        left = (width - new_width) // 2
                        right = left + new_width
                        top, bottom = 0, height
                    else:
                        # Image is too tall, trim the top and bottom
                        new_height = int(width * target_height / target_width)
                        top = (height - new_height) // 2
                        bottom = top + new_height
                        left, right = 0, width

                    img = img.crop((left, top, right, bottom))
                    # Replace deprecated ANTIALIAS with LANCZOS (the modern equivalent)
                    img = img.resize((target_width, target_height), Image.LANCZOS)

                    # Save the resized image to the images folder
                    resized_file_path = os.path.join(IMAGES_FOLDER, filename)
                    img.save(resized_file_path)

                    # Track successful uploads
                    uploaded_files.append(filename)
                    uploaded_count += 1
                    
                    print(f"Successfully processed {filename}: Original saved to {original_file_path}, Resized saved to {resized_file_path}")
            except Exception as e:
                print(f"Error processing image {filename}: {str(e)}")
                skipped_files.append(f"{filename} (error during processing: {str(e)})")
                skipped_count += 1

        return {
            "message": "Files uploaded successfully",
            "uploaded_count": uploaded_count,
            "skipped_count": skipped_count,
            "uploaded_files": uploaded_files,
            "skipped_files": skipped_files
        }
    except Exception as e:
        print(f"Error uploading files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/file_statuses")
async def get_file_statuses():
    """Get statuses for all files"""
    try:
        statuses = load_file_statuses()
        return statuses
    except Exception as e:
        print(f"Error loading file statuses: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/file_status/{filename}")
async def update_file_status(filename: str, data: Dict = Body(...)):
    """Update status for a specific file"""
    try:
        status = data.get("status", "IN_PROGRESS")
        
        # Validate status
        if status not in ["DONE", "IN_PROGRESS", "ATTENTION"]:
            raise HTTPException(status_code=400, detail="Invalid status value")
            
        # Load existing statuses
        statuses = load_file_statuses()
        
        # Update the status for this file
        statuses[filename] = status
        
        # Save back to file
        save_file_statuses(statuses)
        
        return {"message": f"Status updated for {filename}", "status": status}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating file status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/predict/{filename}")
async def predict_image(filename: str, visualize: bool = True):
    """Perform YOLO prediction on a specific image in the images folder."""
    try:
        # Construct full path to the image
        image_path = os.path.join(IMAGES_FOLDER, filename)
        # Check if the file exists
        if not os.path.isfile(image_path):
            raise HTTPException(status_code=404, detail=f"Image file {filename} not found")
        
        # Call the predict function from yolo_predict module
        try:
            if visualize:
                # Generate visualization and return both prediction results and visualization
                vis_path = yolo_predict.predict_and_visualize(image_path, return_mode='path')
                results = yolo_predict.predict(image_path)
                formatted_results = yolo_predict.format_results(results)
                
                # Return results with visualization path
                return {
                    "success": True,
                    "filename": filename,
                    "predictions": formatted_results,
                    "visualization": os.path.basename(vis_path) if vis_path else None
                }
            else:
                # Just return prediction results without visualization
                results = yolo_predict.predict(image_path)
                formatted_results = yolo_predict.format_results(results)
                
                return {
                    "success": True,
                    "filename": filename,
                    "predictions": formatted_results
                }
        except Exception as e:
            print(f"Prediction error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error during prediction: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing prediction request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/visualizations/{filename}")
async def get_visualization(filename: str):
    """Serve visualization images with bounding boxes."""
    vis_path = os.path.join(yolo_predict.VISUALIZATIONS_DIR, filename)
    
    if not os.path.isfile(vis_path):
        raise HTTPException(status_code=404, detail=f"Visualization {filename} not found")
    
    return FileResponse(
        vis_path,
        headers={"Cache-Control": "max-age=3600"}
    )

@app.get("/setup_training")
async def setup_training():
    """Set up a YOLO training environment with the current dataset."""
    try:
        # Define the training directory
        training_dir = os.path.join(os.getcwd(), "yolo_training")
        
        # 1. Create or clear the training directory
        if os.path.exists(training_dir):
            # Remove all contents
            shutil.rmtree(training_dir)
        
        # Create fresh directory
        os.makedirs(training_dir, exist_ok=True)
        
        # 2. Create necessary subdirectories
        images_train_dir = os.path.join(training_dir, "images", "train")
        labels_train_dir = os.path.join(training_dir, "labels", "train")
        os.makedirs(images_train_dir, exist_ok=True)
        os.makedirs(labels_train_dir, exist_ok=True)
        
        # 3. Copy images and annotations
        # Get list of images
        images = [f for f in os.listdir(IMAGES_FOLDER) 
                  if os.path.isfile(os.path.join(IMAGES_FOLDER, f)) and 
                  f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.gif'))]
        
        # Copy each image and its annotation if it exists
        copied_images = 0
        copied_labels = 0
        
        for image in images:
            # Copy image
            src_image = os.path.join(IMAGES_FOLDER, image)
            dst_image = os.path.join(images_train_dir, image)
            shutil.copy2(src_image, dst_image)
            copied_images += 1
            
            # Copy annotation if it exists
            annotation_file = os.path.splitext(image)[0] + ".txt"
            src_annotation = os.path.join(ANNOTATIONS_FOLDER, annotation_file)
            if os.path.exists(src_annotation):
                dst_annotation = os.path.join(labels_train_dir, annotation_file)
                shutil.copy2(src_annotation, dst_annotation)
                copied_labels += 1
        
        # 4. Create dataset.yaml file
        class_list = [c["name"] for c in load_classes()]
        yaml_content = f"""# YOLO dataset configuration
path: {training_dir}  # Path to dataset root
train: images/train  # Train images folder
val: images/train  # Validation images folder (using train for simplicity)

# Classes
nc: {len(class_list)}  # Number of classes
names: {json.dumps(class_list)}  # Class names
"""
        with open(os.path.join(training_dir, "dataset.yaml"), 'w') as f:
            f.write(yaml_content)
        
        return {
            "success": True,
            "message": "Training environment set up successfully",
            "training_dir": training_dir,
            "images_copied": copied_images,
            "labels_copied": copied_labels,
            "classes": class_list
        }
    except Exception as e:
        print(f"Error setting up training environment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/backup")
async def backup_data():
    """Create a backup zip file containing classes.json, file_statuses.json, 
    images folder, and annotations folder."""
    try:
        # Get current date for filename
        current_date = datetime.now().strftime("%Y_%m_%d")
        zip_filename = f"backup_{current_date}.zip"
        
        # Create a zip file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add classes.json if it exists
            if os.path.exists(CLASSES_FILE):
                zip_file.write(CLASSES_FILE, os.path.basename(CLASSES_FILE))
            
            # Add file_statuses.json if it exists
            if os.path.exists(FILE_STATUS_PATH):
                zip_file.write(FILE_STATUS_PATH, os.path.basename(FILE_STATUS_PATH))
            
            # Add all files from the images folder
            if os.path.exists(IMAGES_FOLDER):
                for root, _, files in os.walk(IMAGES_FOLDER):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Calculate the arcname (path within the zip file)
                        arcname = os.path.join("images", os.path.relpath(file_path, IMAGES_FOLDER))
                        zip_file.write(file_path, arcname)
            
            # Add all files from the annotations folder
            if os.path.exists(ANNOTATIONS_FOLDER):
                for root, _, files in os.walk(ANNOTATIONS_FOLDER):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Calculate the arcname (path within the zip file)
                        arcname = os.path.join("annotations", os.path.relpath(file_path, ANNOTATIONS_FOLDER))
                        zip_file.write(file_path, arcname)
        
        # Reset the buffer position
        zip_buffer.seek(0)
        
        # Return the zip file for download
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={zip_filename}"}
        )
    except Exception as e:
        print(f"Error creating backup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))