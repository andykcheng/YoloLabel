#!/usr/bin/env python3
"""
Script to test the /get_file endpoint of the Image Files API
"""

import requests
import os
import sys

def main():
    """Download a file from the API and save it to the downloads folder"""
    # Check if a filename was provided
    if len(sys.argv) < 2:
        print("Usage: python get_file.py <filename>")
        return
    
    filename = sys.argv[1]
    
    try:
        # Send a GET request to the /get_file endpoint with the filename parameter
        response = requests.get(f"http://localhost:8000/get_file?filename={filename}", stream=True)
        
        # Print the status code
        print(f"Status code: {response.status_code}")
        
        # If the request was successful, save the file
        if response.status_code == 200:
            # Create a downloads directory if it doesn't exist
            downloads_dir = os.path.join(os.getcwd(), "downloads")
            os.makedirs(downloads_dir, exist_ok=True)
            
            # Save the file to the downloads directory
            file_path = os.path.join(downloads_dir, filename)
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"File downloaded successfully to {file_path}")
        else:
            print(f"Error: {response.text}")
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the server. Make sure the API is running.")
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()
