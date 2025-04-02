#!/usr/bin/env python3
"""
Script to run YOLO model training.
This script provides a user-friendly command line interface to train a YOLO model.
"""

import os
import sys
import argparse
import time
from datetime import timedelta

# Add the parent directory to path so we can import the yolo_train module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Debug information to see what's being imported
try:
    import yolo_train
    print(f"Found yolo_train module at: {getattr(yolo_train, '__file__', 'Unknown location')}")
    
    # Explicitly import functions to make sure they're available
    from yolo_train import train, validate
    
except ImportError as e:
    print(f"Error importing yolo_train: {str(e)}")
    print("\nPython path:")
    for p in sys.path:
        print(f"  {p}")
    sys.exit(1)

def format_time(seconds):
    """Format seconds into a human-readable time string."""
    return str(timedelta(seconds=int(seconds)))

def main():
    parser = argparse.ArgumentParser(description="Train a YOLO model on labeled data")
    
    # Training parameters
    parser.add_argument("--epochs", type=int, default=300, 
                        help="Number of training epochs (default: 300)")
    parser.add_argument("--batch", type=int, default=4, 
                        help="Batch size (default: 4)")
    parser.add_argument("--img", type=int, nargs=2, default=[1280, 720], 
                        help="Input image width and height (default: 1280 720)")
    parser.add_argument("--device", type=str, default=None, 
                        help="Training device, e.g., 0 for GPU 0, cpu for CPU (default: auto)")
    parser.add_argument("--workers", type=int, default=8, 
                        help="Number of worker threads (default: 8)")
    parser.add_argument("--patience", type=int, default=50, 
                        help="Early stopping patience (default: 50)")
    
    # Training control
    parser.add_argument("--resume", action="store_true", 
                        help="Resume training from last checkpoint")
    parser.add_argument("--validate", action="store_true", 
                        help="Validate the trained model after training")
    parser.add_argument("--validate-only", action="store_true", 
                        help="Only validate the model without training")
    
    args = parser.parse_args()
    
    # Display training info header
    print("\n" + "="*70)
    print(f"{'YOLO Model Training':^70}")
    print("="*70)
    
    # If validation only is selected, just run validation
    if args.validate_only:
        print("\nValidating existing model...")
        results = validate()
        
        if results["success"]:
            print("\n📊 Validation Results:")
            print(f"Precision: {results['metrics']['precision']:.4f}")
            print(f"Recall: {results['metrics']['recall']:.4f}")
            print(f"mAP50: {results['metrics']['mAP50']:.4f}")
            print(f"mAP50-95: {results['metrics']['mAP50-95']:.4f}")
        else:
            print(f"\n❌ Validation failed: {results.get('error')}")
        return
    
    # Display training configuration
    print("\n📋 Training Configuration:")
    print(f"  Model: YOLOv11n (will be downloaded automatically if needed)")
    print(f"  Epochs: {args.epochs}")
    print(f"  Batch size: {args.batch}")
    print(f"  Image size: {args.img[0]}x{args.img[1]}")
    print(f"  Device: {args.device if args.device else 'auto'}")
    print(f"  Workers: {args.workers}")
    if args.resume:
        print("  Resuming from checkpoint: Yes")
    else:
        print("  Output directory will be reset: Yes")
    
    # Ask for confirmation
    if input("\nProceed with training? (y/n): ").lower() != 'y':
        print("Training cancelled.")
        return
    
    # Start training
    print("\n🚀 Starting training...")
    start_time = time.time()
    
    results = train(
        epochs=args.epochs,
        batch_size=args.batch,
        image_size=args.img,  # Now passing a list of [width, height]
        device=args.device,
        workers=args.workers,
        patience=args.patience,
        resume=args.resume,
        verbose=True,
    )
    
    # Display training results
    if results["success"]:
        print("\n✅ Training completed successfully!")
        print(f"Training time: {format_time(results['training_time'])}")
        print(f"Best model saved to: {results['best_model_path']}")
        print(f"Final model saved to: {results['last_model_path']}")
        
        # If validation is requested
        if args.validate:
            print("\nValidating trained model...")
            val_results = validate(results['best_model_path'])
            
            if val_results["success"]:
                print("\n📊 Validation Results:")
                print(f"Precision: {val_results['metrics']['precision']:.4f}")
                print(f"Recall: {val_results['metrics']['recall']:.4f}")
                print(f"mAP50: {val_results['metrics']['mAP50']:.4f}")
                print(f"mAP50-95: {val_results['metrics']['mAP50-95']:.4f}")
    else:
        print(f"\n❌ Training failed: {results.get('error')}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nTraining interrupted by user.")
    except Exception as e:
        print(f"\nError: {str(e)}")
