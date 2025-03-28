#!/usr/bin/env python3
"""
Test script for the YOLO prediction API endpoint.
This script sends a request to the FastAPI server to predict objects in a specified image.
"""

import requests
import json
import os
import sys
import argparse
from pprint import pprint

# Default API URL if running locally
DEFAULT_API_URL = "http://localhost:8000"

def test_prediction(api_url, image_filename):
    """
    Test the prediction endpoint with the specified image.
    
    Args:
        api_url (str): Base URL of the API
        image_filename (str): Name of the image file to predict
    
    Returns:
        dict: Prediction response or error information
    """
    # Construct the full endpoint URL
    endpoint = f"{api_url}/predict/{image_filename}"
    
    print(f"Testing prediction on image: {image_filename}")
    print(f"Using endpoint: {endpoint}")
    
    try:
        # Send GET request to the prediction endpoint
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

def list_images(api_url):
    """
    List available images from the API.
    
    Args:
        api_url (str): Base URL of the API
    
    Returns:
        list: List of available image filenames or error information
    """
    try:
        response = requests.get(f"{api_url}/list_files")
        if response.status_code == 200:
            return response.json()
        else:
            return []
    except:
        return []

def main():
    # Set up command line argument parsing
    parser = argparse.ArgumentParser(description="Test the YOLO prediction API endpoint")
    parser.add_argument("--url", default=DEFAULT_API_URL, help=f"API base URL (default: {DEFAULT_API_URL})")
    parser.add_argument("--image", help="Image filename to use for prediction")
    parser.add_argument("--list", action="store_true", help="List available images instead of predicting")
    
    args = parser.parse_args()
    
    # If --list flag is provided, list available images
    if args.list:
        print("Listing available images:")
        images = list_images(args.url)
        if images:
            for idx, img in enumerate(images, 1):
                print(f"{idx}. {img}")
            print(f"\nTotal: {len(images)} images")
        else:
            print("No images found or couldn't connect to server")
        return
    
    # If no image is specified, show usage
    if not args.image:
        print("Error: No image specified")
        print("Use --image FILENAME to specify an image for prediction")
        print("Use --list to see available images")
        return
    
    # Run the prediction test
    result = test_prediction(args.url, args.image)
    
    print("\nPrediction Results:")
    print("-" * 40)
    
    # Pretty print the results
    if "error" in result:
        print(f"ERROR: {result['error']}")
    else:
        if result.get("success", False):
            print(f"Image: {result.get('filename')}")
            print(f"Found {len(result.get('predictions', []))} predictions:")
            
            # Format and display each prediction
            for i, pred in enumerate(result.get("predictions", []), 1):
                print(f"\nPrediction {i}:")
                pprint(pred)
        else:
            print("Prediction failed. Response:")
            pprint(result)

if __name__ == "__main__":
    main()
