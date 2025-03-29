#!/usr/bin/env python3
"""
Script to trigger the YOLO training setup endpoint.
This script sends a request to the FastAPI server to set up the YOLO training environment.
"""

import requests
import json
import os
import sys
import argparse
from pprint import pprint

# Default API URL if running locally
DEFAULT_API_URL = "http://localhost:8000"

def setup_training(api_url, verbose=False):
    """
    Trigger the training setup endpoint.
    
    Args:
        api_url (str): Base URL of the API
        verbose (bool): Whether to print detailed information
    
    Returns:
        dict: Setup response or error information
    """
    # Construct the endpoint URL
    endpoint = f"{api_url}/train"
    
    print("Setting up YOLO training environment...")
    print(f"Using endpoint: {endpoint}")
    
    try:
        # Send GET request to the training setup endpoint
        response = requests.get(endpoint)
        
        # Check if request was successful
        if response.status_code == 200:
            # Parse JSON response
            result = response.json()
            return result
        else:
            # Handle error responses
            error_msg = f"Error: {response.status_code}"
            try:
                error_msg += f" - {response.json().get('detail', '')}"
            except:
                error_msg += f" - {response.text}"
            return {"error": error_msg}
            
    except requests.exceptions.ConnectionError:
        return {"error": f"Connection error: Unable to connect to {api_url}. Is the server running?"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}

def main():
    # Set up command line argument parsing
    parser = argparse.ArgumentParser(description="Set up YOLO training environment")
    parser.add_argument("--url", default=DEFAULT_API_URL, help=f"API base URL (default: {DEFAULT_API_URL})")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed information")
    
    args = parser.parse_args()
    
    # Run the training setup
    result = setup_training(args.url, args.verbose)
    
    print("\nTraining Setup Results:")
    print("-" * 50)
    
    # Handle and display the results
    if "error" in result:
        print(f"ERROR: {result['error']}")
        sys.exit(1)
    elif result.get("success", False):
        print(f"✅ Setup completed successfully!")
        print(f"📁 Training directory: {result.get('training_dir')}")
        print(f"🖼️  Images copied: {result.get('images_copied')}")
        print(f"🏷️  Labels copied: {result.get('labels_copied')}")
        
        # Print classes if available
        classes = result.get("classes", [])
        if classes:
            print(f"📊 Classes ({len(classes)}):")
            for i, cls in enumerate(classes):
                print(f"  {i}: {cls}")
        
        print("\nThe training environment is now ready for YOLOv8.")
        print("You can train a model using the following command:")
        print("yolo train model=yolov8n.pt data=yolo_training/dataset.yaml epochs=50")
    else:
        print("⚠️ Setup completed but with unexpected response:")
        pprint(result)

if __name__ == "__main__":
    main()
