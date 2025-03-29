"""
YOLO prediction module for YoloLabel application.
This module provides functions to perform object detection on images using YOLOv8 models.
"""

import os
import sys
import io
from pathlib import Path
from typing import List, Dict, Any, Optional, Union, Tuple

try:
    from ultralytics import YOLO
    import cv2
    import numpy as np
    from PIL import Image
except ImportError as e:
    module = str(e).split("'")[-2]
    raise ImportError(
        f"{module} package is required. Install with: pip install {module}"
    )

# Constants
DEFAULT_MODEL = "yolov8n.pt"  # Default model to use if no custom model is available
CUSTOM_MODEL_DIR = os.path.join(os.getcwd(), "custom_yolo_model")
CONFIDENCE_THRESHOLD = 0.25  # Minimum confidence threshold for detections
VISUALIZATIONS_DIR = os.path.join(os.getcwd(), "visualizations")  # Directory to store visualizations
os.makedirs(VISUALIZATIONS_DIR, exist_ok=True)  # Create the directory if it doesn't exist

def get_best_model() -> str:
    """
    Find the best available YOLO model to use for prediction.
    Prioritizes custom models from the custom_yolo_model folder.
    
    Returns:
        str: Path to the best available model
    """
    # Check for best model in custom model directory
    custom_best_model = os.path.join(CUSTOM_MODEL_DIR, "best.pt")
    if os.path.exists(custom_best_model):
        print(f"Using custom model: {custom_best_model}")
        return custom_best_model
    
    # Check for last model in custom model directory
    custom_last_model = os.path.join(CUSTOM_MODEL_DIR, "last.pt")
    if os.path.exists(custom_last_model):
        print(f"Using custom model: {custom_last_model}")
        return custom_last_model
    
    # Fall back to default model if no custom model is available
    print(f"No custom model found, using default model: {DEFAULT_MODEL}")
    return DEFAULT_MODEL

def predict(
    image_path: str, 
    conf: float = CONFIDENCE_THRESHOLD,
    model_path: Optional[str] = None,
    save_visualization: bool = False,
    visualization_path: Optional[str] = None
) -> List[Any]:
    """
    Run YOLO prediction on an image.
    
    Args:
        image_path: Path to the image file
        conf: Confidence threshold for detections (0-1)
        model_path: Path to a specific model file (optional)
        save_visualization: Whether to save an image with bounding boxes
        visualization_path: Path to save the visualization (if None, auto-generated)
        
    Returns:
        List of YOLO results
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")
    
    # Determine which model to use
    if model_path is None:
        model_path = get_best_model()
    
    # Load the model
    model = YOLO(model_path)
    
    # Run prediction
    results = model.predict(
        source=image_path,
        conf=conf,
        save=save_visualization,  # Save visualization if requested
        project=VISUALIZATIONS_DIR if save_visualization else None,
        name="" if save_visualization else None,
        verbose=False  # Don't print progress to console
    )
    
    # If custom visualization path is specified, but YOLO didn't save one (or saved to default location)
    if save_visualization and visualization_path:
        # Get the first result's plotted image (with boxes drawn)
        for r in results:
            if hasattr(r, 'plot') and callable(r.plot):
                # Generate the visualization directly
                vis_img = r.plot()
                # Convert numpy array to PIL Image
                img = Image.fromarray(vis_img)
                # Save to the specified path
                img.save(visualization_path)
                break
    
    return results

def predict_and_visualize(
    image_path: str, 
    conf: float = CONFIDENCE_THRESHOLD,
    model_path: Optional[str] = None,
    return_mode: str = "path",  # 'path', 'bytes', or 'array'
    line_width: int = 2,
    font_size: float = 1.0,
    box_color: Optional[Tuple[int, int, int]] = None,  # RGB color tuple
) -> Union[str, bytes, np.ndarray, None]:
    """
    Run YOLO prediction and return a visualization with bounding boxes.
    
    Args:
        image_path: Path to the image file
        conf: Confidence threshold for detections (0-1)
        model_path: Path to a specific model file (optional)
        return_mode: How to return the visualization ('path', 'bytes', or 'array')
        line_width: Width of bounding box lines
        font_size: Size of the font for labels
        box_color: Custom color for bounding boxes (RGB tuple)
        
    Returns:
        Depending on return_mode:
        - 'path': Path to the saved visualization image
        - 'bytes': Bytes of the visualization image
        - 'array': Numpy array of the visualization image
        - None if an error occurs
    """
    try:
        # Generate a unique filename for the visualization
        vis_filename = f"{Path(image_path).stem}_visualization.jpg"
        vis_path = os.path.join(VISUALIZATIONS_DIR, vis_filename)
        
        # Run prediction
        results = predict(image_path, conf, model_path, False)
        
        if not results:
            return None
        
        # Get the first result
        result = results[0]
        
        # Generate visualization
        boxes = result.boxes
        img = cv2.imread(image_path)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)  # Convert to RGB
        
        # Plot boxes manually if we want custom styling
        if box_color or line_width != 2 or font_size != 1.0:
            for box in boxes:
                # Get coordinates
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                class_id = int(box.cls)
                conf_score = float(box.conf)
                
                # Get color (convert from RGB to BGR for OpenCV)
                color = tuple(reversed(box_color)) if box_color else (0, 255, 0)
                
                # Draw box
                cv2.rectangle(img, (x1, y1), (x2, y2), color, line_width)
                
                # Draw label
                label = f"{result.names[class_id]} {conf_score:.2f}"
                font_scale = font_size * 0.7
                text_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 2)[0]
                cv2.rectangle(img, (x1, y1 - text_size[1] - 5), (x1 + text_size[0], y1), color, -1)
                cv2.putText(img, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), 2)
        else:
            # Use built-in plotting function
            img = result.plot()
        
        # Save the visualization
        if return_mode == 'path':
            cv2.imwrite(vis_path, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
            return vis_path
        
        # Return as bytes
        elif return_mode == 'bytes':
            img_pil = Image.fromarray(img)
            img_byte_arr = io.BytesIO()
            img_pil.save(img_byte_arr, format='JPEG')
            return img_byte_arr.getvalue()
        
        # Return as numpy array
        elif return_mode == 'array':
            return img
        
        else:
            raise ValueError(f"Invalid return_mode: {return_mode}")
    
    except Exception as e:
        print(f"Error creating visualization: {str(e)}")
        return None

def format_results(results) -> List[Dict[str, Any]]:
    """
    Format YOLO results into a more usable structure.
    
    Args:
        results: Results from YOLO prediction
        
    Returns:
        List of formatted detection results
    """
    formatted_results = []
    
    for result in results:
        boxes = []
        
        # Process detection boxes
        if result.boxes is not None:
            for i, box in enumerate(result.boxes):
                # Get box data
                try:
                    class_id = int(box.cls.item())
                    confidence = float(box.conf.item())
                    x1, y1, x2, y2 = [float(x) for x in box.xyxy.squeeze().tolist()]
                    
                    # Calculate width and height
                    width = x2 - x1
                    height = y2 - y1
                    
                    # Convert to center format (YOLO preferred format)
                    x_center = x1 + width / 2
                    y_center = y1 + height / 2
                    
                    # Normalize coordinates (YOLO format)
                    img_width, img_height = result.orig_shape[1], result.orig_shape[0]
                    x_center_norm = x_center / img_width
                    y_center_norm = y_center / img_height
                    width_norm = width / img_width
                    height_norm = height / img_height
                    
                    # Create box entry
                    box_data = {
                        "class": class_id,
                        "name": result.names.get(class_id, f"Class {class_id}"),
                        "confidence": confidence,
                        "x_center": x_center_norm,
                        "y_center": y_center_norm,
                        "width": width_norm,
                        "height": height_norm,
                        # Also include pixel coordinates for convenience
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2
                    }
                    
                    boxes.append(box_data)
                except Exception as e:
                    print(f"Error processing box {i}: {str(e)}")
                    continue
        
        # Compile result data
        formatted_result = {
            "boxes": boxes,
            "image_width": result.orig_shape[1],
            "image_height": result.orig_shape[0],
            "image_path": result.path,
            "prediction_time": result.speed.get('inference', 0)
        }
        
        formatted_results.append(formatted_result)
    
    return formatted_results

if __name__ == "__main__":
    # Simple command-line interface when run directly
    import argparse
    from pprint import pprint
    
    parser = argparse.ArgumentParser(description="Run YOLO prediction on an image")
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--conf", type=float, default=CONFIDENCE_THRESHOLD, 
                        help=f"Confidence threshold (default: {CONFIDENCE_THRESHOLD})")
    parser.add_argument("--model", help="Path to a specific model file")
    parser.add_argument("--visualize", action="store_true", help="Generate visualization with bounding boxes")
    parser.add_argument("--line-width", type=int, default=2, help="Width of bounding box lines")
    parser.add_argument("--color", help="Bounding box color as R,G,B (e.g., 255,0,0 for red)")
    
    args = parser.parse_args()
    
    try:
        # Parse custom color if provided
        box_color = None
        if args.color:
            try:
                box_color = tuple(map(int, args.color.split(',')))
                if len(box_color) != 3:
                    print("Warning: Color must be specified as R,G,B. Using default color.")
                    box_color = None
            except:
                print("Warning: Invalid color format. Using default color.")
        
        if args.visualize:
            # Generate visualization
            vis_path = predict_and_visualize(
                args.image_path, 
                args.conf, 
                args.model,
                line_width=args.line_width,
                box_color=box_color
            )
            
            if vis_path:
                print(f"\nVisualization saved to: {vis_path}")
            else:
                print("\nFailed to generate visualization")
        
        # Run prediction
        results = predict(args.image_path, args.conf, args.model)
        
        # Format and print results
        formatted_results = format_results(results)
        
        for i, result in enumerate(formatted_results):
            print(f"\nResult {i+1}:")
            print(f"Image: {result['image_path']} ({result['image_width']}x{result['image_height']})")
            print(f"Prediction time: {result['prediction_time']} ms")
            print(f"Detected {len(result['boxes'])} objects:")
            
            for j, box in enumerate(result['boxes']):
                print(f"  {j+1}. {box['name']} ({box['confidence']:.2f})")
    
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
