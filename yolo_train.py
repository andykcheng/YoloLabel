"""
YOLO training module for YoloLabel application.
This module provides functions to train YOLO models on labeled datasets.
"""

import os
import shutil
import yaml
import time
from pathlib import Path
from typing import Dict, Any, Optional, Union, List

try:
    from ultralytics import YOLO
except ImportError:
    raise ImportError(
        "Ultralytics YOLO package is required. Install it with: pip install ultralytics"
    )

# Constants
DEFAULT_MODEL = "yolov8n.pt"  # Smallest YOLOv8 model
TRAINING_DIR = os.path.join(os.getcwd(), "yolo_training")
OUTPUT_DIR = os.path.join(os.getcwd(), "custom_yolo_model")

def train(
    epochs: int = 50,
    batch_size: int = 16,
    image_size: int = 640,
    model_size: str = "n",  # n, s, m, l, x
    patience: int = 50,
    device: Optional[str] = None,
    workers: int = 8,
    resume: bool = False,
    verbose: bool = True,
) -> Dict[str, Any]:
    """
    Train a YOLO model using data in the yolo_training folder.
    
    Args:
        epochs: Number of training epochs
        batch_size: Training batch size
        image_size: Input image size
        model_size: YOLO model size (n=nano, s=small, m=medium, l=large, x=xlarge)
        patience: Early stopping patience
        device: Device to run on (cuda device or 'cpu')
        workers: Number of worker threads for data loading
        resume: Resume training from last checkpoint
        verbose: Print verbose output
        
    Returns:
        Dict containing training results and paths to saved model files
    """
    start_time = time.time()
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Check if training directory exists and contains necessary data
    if not os.path.exists(TRAINING_DIR):
        raise ValueError(f"Training directory not found: {TRAINING_DIR}")
    
    yaml_path = os.path.join(TRAINING_DIR, "dataset.yaml")
    if not os.path.exists(yaml_path):
        raise ValueError(f"Dataset configuration not found: {yaml_path}")
    
    # Load the dataset config to check structure
    with open(yaml_path, 'r') as f:
        dataset_config = yaml.safe_load(f)
    
    train_path = os.path.join(TRAINING_DIR, dataset_config.get('train', ''))
    if not os.path.exists(train_path):
        raise ValueError(f"Training images not found: {train_path}")
    
    # Determine the model path
    model_path = f"yolov8{model_size}.pt"
    if not model_size in ['n', 's', 'm', 'l', 'x']:
        print(f"Warning: Invalid model size '{model_size}', defaulting to 'n'")
        model_path = DEFAULT_MODEL
    
    # If custom model exists in output dir and resume is True, use it
    custom_model_path = os.path.join(OUTPUT_DIR, "best.pt")
    if resume and os.path.exists(custom_model_path):
        print(f"Resuming training from {custom_model_path}")
        model_path = custom_model_path
    
    if verbose:
        print(f"Starting YOLO training with the following configuration:")
        print(f"  Model: {model_path}")
        print(f"  Dataset: {yaml_path}")
        print(f"  Epochs: {epochs}")
        print(f"  Batch size: {batch_size}")
        print(f"  Image size: {image_size}")
        print(f"  Output directory: {OUTPUT_DIR}")
    
    try:
        # Load a model
        model = YOLO(model_path)
        
        # Train the model - results are saved to the specified project/name directory
        results = model.train(
            data=yaml_path,
            epochs=epochs,
            batch=batch_size,
            imgsz=image_size,
            patience=patience,
            device=device,
            workers=workers,
            project=os.path.dirname(OUTPUT_DIR),
            name=os.path.basename(OUTPUT_DIR),
            exist_ok=True,
            verbose=verbose,
        )
        
        # Find the best and last model files based on standard YOLO save patterns
        # The models are typically saved in: {project}/{name}/weights/
        weights_dir = os.path.join(OUTPUT_DIR, "weights")
        best_model_path = os.path.join(weights_dir, "best.pt")
        last_model_path = os.path.join(weights_dir, "last.pt")
        
        # Copy the model files to the output directory root for easier access
        if os.path.exists(best_model_path):
            output_best_path = os.path.join(OUTPUT_DIR, "best.pt")
            shutil.copy2(best_model_path, output_best_path)
            best_model_path = output_best_path
        else:
            # If the standard path doesn't work, try to find the model file
            best_model_path = None
            if verbose:
                print("Warning: Could not find best model file in standard location")
        
        if os.path.exists(last_model_path):
            output_last_path = os.path.join(OUTPUT_DIR, "last.pt")
            shutil.copy2(last_model_path, output_last_path)
            last_model_path = output_last_path
        else:
            last_model_path = None
            if verbose:
                print("Warning: Could not find last model file in standard location")
        
        # Training is complete - prepare return information
        training_time = time.time() - start_time
        
        # Extract available metrics from results
        metrics = {}
        if hasattr(results, 'results_dict'):
            metrics = results.results_dict
        
        return {
            "success": True,
            "training_time": training_time,
            "epochs_completed": getattr(results, 'epoch', epochs),
            "best_model_path": best_model_path,
            "last_model_path": last_model_path,
            "results": metrics
        }
    
    except Exception as e:
        if verbose:
            print(f"Training error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "training_time": time.time() - start_time
        }

def validate(model_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Validate a trained YOLO model on the training dataset.
    
    Args:
        model_path: Path to the model file (defaults to best.pt in OUTPUT_DIR)
        
    Returns:
        Dict containing validation results
    """
    if model_path is None:
        model_path = os.path.join(OUTPUT_DIR, "best.pt")
    
    if not os.path.exists(model_path):
        return {
            "success": False,
            "error": f"Model not found: {model_path}"
        }
    
    yaml_path = os.path.join(TRAINING_DIR, "dataset.yaml")
    if not os.path.exists(yaml_path):
        return {
            "success": False,
            "error": f"Dataset configuration not found: {yaml_path}"
        }
    
    try:
        # Load the model
        model = YOLO(model_path)
        
        # Validate the model
        results = model.val(data=yaml_path)
        
        return {
            "success": True,
            "metrics": {
                "precision": float(results.results_dict.get('metrics/precision(B)', 0)),
                "recall": float(results.results_dict.get('metrics/recall(B)', 0)),
                "mAP50": float(results.results_dict.get('metrics/mAP50(B)', 0)),
                "mAP50-95": float(results.results_dict.get('metrics/mAP50-95(B)', 0))
            },
            "confusion_matrix": results.confusion_matrix.matrix.tolist() if hasattr(results, 'confusion_matrix') else None,
            "results": results.results_dict
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    # Simple command-line interface when run directly
    import argparse
    
    parser = argparse.ArgumentParser(description="Train a YOLO model")
    parser.add_argument("--epochs", type=int, default=50, help="Number of epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--img", type=int, default=640, help="Image size")
    parser.add_argument("--model", type=str, default="n", help="Model size (n, s, m, l, x)")
    parser.add_argument("--resume", action="store_true", help="Resume training from last checkpoint")
    parser.add_argument("--validate", action="store_true", help="Validate instead of train")
    
    args = parser.parse_args()
    
    if args.validate:
        print("Validating model...")
        results = validate()
        if results["success"]:
            print("\nValidation Results:")
            print(f"Precision: {results['metrics']['precision']:.4f}")
            print(f"Recall: {results['metrics']['recall']:.4f}")
            print(f"mAP50: {results['metrics']['mAP50']:.4f}")
            print(f"mAP50-95: {results['metrics']['mAP50-95']:.4f}")
        else:
            print(f"Validation failed: {results.get('error')}")
    else:
        print("Starting training...")
        results = train(
            epochs=args.epochs,
            batch_size=args.batch,
            image_size=args.img,
            model_size=args.model,
            resume=args.resume,
            verbose=True
        )
        
        if results["success"]:
            print("\nTraining completed successfully!")
            print(f"Training time: {results['training_time']:.2f} seconds")
            print(f"Best model saved to: {results['best_model_path']}")
        else:
            print(f"Training failed: {results.get('error')}")
